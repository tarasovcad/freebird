import {isJsonObject} from "./guards";
import {simplifyTweetWithResolvedTweets} from "./simplify-tweet";
import type {JsonObject} from "./types";

export async function simplifyStatusResponse(
  status: JsonObject,
  resolveTweet: (url: string) => Promise<JsonObject | null>,
): Promise<JsonObject> {
  if (!isReplyChainResult(status)) {
    return simplifyTweetWithResolvedTweets(status, resolveTweet);
  }

  return {
    ...status,
    tweet: await simplifyTweetWithResolvedTweets(status.tweet, resolveTweet),
    reply_chain: await Promise.all(
      status.reply_chain.map((tweet) => simplifyTweetWithResolvedTweets(tweet, resolveTweet)),
    ),
  };
}

export function isReplyChainResult(
  status: JsonObject,
): status is JsonObject & {tweet: JsonObject; reply_chain: JsonObject[]} {
  return (
    isJsonObject(status.tweet) &&
    Array.isArray(status.reply_chain) &&
    typeof status.reply_chain_complete === "boolean" &&
    status.reply_chain.every((tweet) => isJsonObject(tweet))
  );
}

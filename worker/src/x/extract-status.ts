import {XExtractError} from "./errors";
import {fixTweetData} from "./fix-tweet-data";
import {isJsonObject} from "./guards";
import {extractStatusV2Android} from "./tweet-conversation-timeline-v2-android";
import {extractStatusV2Rest} from "./tweet-result-by-rest-id";
import {extractStatusSyndication} from "./tweet-syndication";
import {
  extractStatusV2TweetDetail,
  extractStatusV2TweetDetailChain,
  getReplyParentId,
  type ReplyChainResult,
} from "./tweet-detail";
import {extractStatusV2} from "./tweet-results-by-ids";
import type {JsonObject} from "./types";

type ExtractStatusOptions = {
  authTokens?: readonly string[];
  simultaneousRequests?: number;
};
//  The extractStatus function tries multiple methods to extract tweet data
export async function extractStatus(
  input: string,
  options: ExtractStatusOptions = {},
): Promise<JsonObject> {
  const authTokens = options.authTokens ?? [];
  const simultaneousRequests = options.simultaneousRequests;

  const attempts: Array<() => Promise<JsonObject>> = [
    () => extractStatusV2Rest(input, []),
    () => extractStatusV2(input, authTokens, {simultaneousRequests}),
    () => extractStatusV2Rest(input, authTokens),
    () => extractStatusV2Android(input, authTokens, {simultaneousRequests}),
    () => extractStatusV2TweetDetail(input, authTokens, {simultaneousRequests}),
  ];

  let lastError: XExtractError | null = null;

  for (const attempt of attempts) {
    try {
      const tweet = await attempt();
      if (hasLegacyTweet(tweet)) {
        return addReplyContextIfNeeded(input, tweet, options);
      }

      lastError = new XExtractError(400, "Extract error");
    } catch (error) {
      if (error instanceof XExtractError) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }
  //  FALLBACK: if all attempts fail - we use the syndication endpoint as a last resort, since it doesn't require auth tokens and can still provide data for some tweets
  // It's not in attempts because it doesn't return a legacy GraphQL shape.
  try {
    return await extractStatusSyndication(input);
  } catch (error) {
    if (error instanceof XExtractError) {
      lastError = error;
    } else {
      throw error;
    }
  }

  throw lastError ?? new XExtractError(400, "Extract error");
}

async function addReplyContextIfNeeded(
  input: string,
  tweet: JsonObject,
  options: ExtractStatusOptions,
): Promise<JsonObject> {
  const authTokens = options.authTokens ?? [];
  const simultaneousRequests = options.simultaneousRequests;
  const fixedTweet = fixTweetData(tweet);
  const parentId = getReplyParentId(fixedTweet);

  if (!parentId) {
    return fixedTweet;
  }

  try {
    return normalizeReplyChainResult(
      await extractStatusV2TweetDetailChain(input, authTokens, {simultaneousRequests}, fixedTweet),
    );
  } catch (error) {
    if (!(error instanceof XExtractError)) {
      throw error;
    }

    return {
      tweet: fixedTweet,
      reply_chain: [],
      reply_chain_complete: false,
      missing_reply_to_status_id: parentId,
    };
  }
}

function hasLegacyTweet(tweet: JsonObject): boolean {
  return isJsonObject(tweet.legacy);
}

function normalizeReplyChainResult(result: ReplyChainResult): ReplyChainResult {
  return {
    ...result,
    tweet: fixTweetData(result.tweet),
    reply_chain: result.reply_chain.map((tweet) => fixTweetData(tweet)),
  };
}

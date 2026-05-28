import {getAuthHeaders, getGuestToken} from "./auth";
import {
  TWEET_RESULT_BY_REST_ID_FEATURES,
  TWEET_RESULT_BY_REST_ID_FIELD_TOGGLES,
  TWEET_RESULT_BY_REST_ID_QUERY_ID,
} from "./constants";
import {XExtractError} from "./errors";
import {isJsonObject} from "./guards";
import {parseTweetId} from "./tweet-url";
import type {JsonObject} from "./types";
import {shuffleWorkaroundTokens} from "./workaround-tokens";

export async function extractStatusV2Rest(
  input: string,
  authTokens: readonly string[] = [],
): Promise<JsonObject> {
  const tweetId = parseTweetId(input);
  const guestToken = await getGuestToken();

  // first try to use the auth tokens
  for (const authToken of shuffleWorkaroundTokens(authTokens)) {
    try {
      return await fetchTweetResultByRestId(tweetId, guestToken, authToken);
    } catch (error) {
      if (!(error instanceof XExtractError)) {
        throw error;
      }
    }
  }
  console.log("no auth tokens - using guest token");
  // if no auth tokens are provided, use the guest token
  return fetchTweetResultByRestId(tweetId, guestToken);
}

async function fetchTweetResultByRestId(
  tweetId: string,
  guestToken: string,
  authToken?: string,
): Promise<JsonObject> {
  const response = await fetch(buildTweetResultByRestIdUrl(tweetId), {
    headers: getAuthHeaders({authToken, guestToken}),
  });

  if (response.status === 429) {
    throw new XExtractError(400, "Extract error");
  }

  const output = await readJsonObject(response);

  if ("errors" in output) {
    throw new XExtractError(400, "Extract error");
  }

  const tweet = parseTweetResultByRestId(output, tweetId);
  flattenLegacyCard(tweet);
  requireLegacyTweet(tweet);

  return tweet;
}

/*   HELPER FUNCTIONS   */

function buildTweetResultByRestIdUrl(tweetId: string): string {
  const variables = {
    tweetId,
    includePromotedContent: true,
    withBirdwatchNotes: true,
    withVoice: true,
    withCommunity: true,
  };
  const searchParams = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(TWEET_RESULT_BY_REST_ID_FEATURES),
    fieldToggles: JSON.stringify(TWEET_RESULT_BY_REST_ID_FIELD_TOGGLES),
  });

  return `https://x.com/i/api/graphql/${TWEET_RESULT_BY_REST_ID_QUERY_ID}/TweetResultByRestId?${searchParams}`;
}

async function readJsonObject(response: Response): Promise<JsonObject> {
  const body: unknown = await response.json();
  if (!isJsonObject(body)) {
    throw new XExtractError(400, "Extract error");
  }

  return body;
}

function parseTweetResultByRestId(output: JsonObject, tweetId: string): JsonObject {
  const data = output.data;
  if (!isJsonObject(data)) {
    throw new XExtractError(400, "Extract error");
  }

  const tweetResult = data.tweetResult;
  if (!isJsonObject(tweetResult)) {
    throw new XExtractError(400, "Extract error");
  }

  const result = unwrapTweetResult(tweetResult.result);
  if (result.rest_id !== tweetId) {
    throw new XExtractError(400, "Extract error");
  }

  return result;
}

function unwrapTweetResult(result: unknown): JsonObject {
  if (!isJsonObject(result)) {
    throw new XExtractError(400, "Extract error");
  }

  if (result.__typename === "TweetWithVisibilityResults") {
    const tweet = result.tweet;
    if (isJsonObject(tweet)) {
      return tweet;
    }
  }

  if (result.__typename === "TweetUnavailable") {
    const reason = typeof result.reason === "string" ? `: ${result.reason}` : "";
    throw new XExtractError(400, `Extract error${reason}`);
  }

  return result;
}

function flattenLegacyCard(tweet: JsonObject): void {
  const card = tweet.card;
  if (!isJsonObject(card)) {
    return;
  }

  const legacy = card.legacy;
  if (isJsonObject(legacy)) {
    tweet.card = legacy;
  }
}

function requireLegacyTweet(tweet: JsonObject): void {
  if (!isJsonObject(tweet.legacy)) {
    throw new XExtractError(400, "Extract error");
  }
}

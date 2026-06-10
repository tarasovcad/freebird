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

  // Auth requests intentionally omit the guest token. X's CDN keys its cache on
  // (URL + x-guest-token) and ignores the auth_token cookie, so sending the same
  // guest token for both auth and guest requests causes them to share X's cache
  // entry and return the same response regardless of authentication level.
  for (const authToken of shuffleWorkaroundTokens(authTokens)) {
    try {
      return await fetchTweetResultByRestId(tweetId, undefined, authToken);
    } catch (error) {
      if (!(error instanceof XExtractError)) {
        throw error;
      }
    }
  }

  const guestToken = await getGuestToken();
  console.log("no auth tokens - using guest token");
  return fetchTweetResultByRestId(tweetId, guestToken);
}

async function fetchTweetResultByRestId(
  tweetId: string,
  guestToken: string | undefined,
  authToken?: string,
): Promise<JsonObject> {
  const response = await fetch(buildTweetResultByRestIdUrl(tweetId), {
    headers: getAuthHeaders({authToken, guestToken}),
  });

  if (response.status === 429) {
    throw new XExtractError(429, "rate_limited", "X rate limit reached. Try again later.");
  }

  const output = await readJsonObject(response);

  if ("errors" in output) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
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
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  return body;
}

function parseTweetResultByRestId(output: JsonObject, tweetId: string): JsonObject {
  const data = output.data;
  if (!isJsonObject(data)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  const tweetResult = data.tweetResult;
  if (!isJsonObject(tweetResult)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  const result = unwrapTweetResult(tweetResult.result);
  if (result.rest_id !== tweetId) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  return result;
}

function unwrapTweetResult(result: unknown): JsonObject {
  if (!isJsonObject(result)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  if (result.__typename === "TweetWithVisibilityResults") {
    const tweet = result.tweet;
    if (isJsonObject(tweet)) {
      return tweet;
    }
  }

  if (result.__typename === "TweetUnavailable") {
    const reason = typeof result.reason === "string" ? result.reason : "Tweet is unavailable.";
    throw new XExtractError(404, "not_found", reason);
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
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }
}

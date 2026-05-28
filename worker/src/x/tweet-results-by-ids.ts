import {getAuthHeaders} from "./auth";
import {TWEET_RESULTS_BY_IDS_FEATURES, TWEET_RESULTS_BY_IDS_QUERY_ID} from "./constants";
import {XExtractError} from "./errors";
import {isJsonObject} from "./guards";
import {fetchWithTokenAttempts, normalizeSimultaneousRequests} from "./token-attempts";
import {parseTweetId} from "./tweet-url";
import type {JsonObject} from "./types";
import {shuffleWorkaroundTokens} from "./workaround-tokens";

type ExtractStatusV2Options = {
  simultaneousRequests?: number;
};

export async function extractStatusV2(
  input: string,
  authTokens: readonly string[],
  options: ExtractStatusV2Options = {},
): Promise<JsonObject> {
  const tweetId = parseTweetId(input);
  const tokens = shuffleWorkaroundTokens(authTokens);

  if (tokens.length === 0) {
    throw new XExtractError(400, "Extract error (no tokens defined)");
  }

  const simultaneousRequests = normalizeSimultaneousRequests(options.simultaneousRequests);
  return fetchWithTokenAttempts(tokens, simultaneousRequests, (token) =>
    fetchTweetResultsByIds(tweetId, token),
  );
}

async function fetchTweetResultsByIds(tweetId: string, authToken: string): Promise<JsonObject> {
  const response = await fetch(buildTweetResultsByIdsUrl(tweetId), {
    headers: getAuthHeaders({authToken}),
  });

  if (response.status === 429) {
    throw new XExtractError(400, "Extract error: rate limit reached");
  }

  const output = await readJsonObject(response);
  if ("errors" in output) {
    throw new XExtractError(400, "Extract error");
  }

  return parseTweetResultsByIds(output, tweetId);
}

function buildTweetResultsByIdsUrl(tweetId: string): string {
  const variables = {
    includeTweetImpression: true,
    includeHasBirdwatchNotes: false,
    includeEditPerspective: false,
    rest_ids: [tweetId],
    includeEditControl: true,
    includeCommunityTweetRelationship: true,
    includeTweetVisibilityNudge: true,
  };

  const searchParams = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(TWEET_RESULTS_BY_IDS_FEATURES),
  });

  return `https://x.com/i/api/graphql/${TWEET_RESULTS_BY_IDS_QUERY_ID}/TweetResultsByIdsQuery?${searchParams}`;
}

async function readJsonObject(response: Response): Promise<JsonObject> {
  const body: unknown = await response.json();
  if (!isJsonObject(body)) {
    throw new XExtractError(400, "Extract error");
  }

  return body;
}

function parseTweetResultsByIds(output: JsonObject, tweetId: string): JsonObject {
  const data = output.data;
  if (!isJsonObject(data)) {
    throw new XExtractError(400, "Extract error");
  }

  const entries = data.tweet_results;
  if (!Array.isArray(entries)) {
    throw new XExtractError(400, "Extract error");
  }

  for (const entry of entries) {
    if (!isJsonObject(entry)) {
      continue;
    }

    const result = unwrapTweetResult(entry.result);
    if (result === null) {
      continue;
    }

    if (result.unavailableReason !== undefined) {
      return {error: `Tweet unavailable: ${result.unavailableReason}`};
    }

    const tweet = result.tweet;
    if (tweet.rest_id === tweetId) {
      return tweet;
    }
  }

  return {
    error:
      "Tweet not found (404); May be due to invalid tweet, changes in Twitter's API, or a protected account.",
  };
}

function unwrapTweetResult(value: unknown): {tweet: JsonObject; unavailableReason?: string} | null {
  if (!isJsonObject(value)) {
    return null;
  }

  if (value.__typename === "TweetWithVisibilityResults") {
    const nestedTweet = value.tweet;
    if (!isJsonObject(nestedTweet)) {
      return null;
    }

    return {tweet: nestedTweet};
  }

  if (value.__typename === "TweetUnavailable") {
    const reason = typeof value.reason === "string" ? value.reason : "Tweet unavailable";
    return {tweet: {error: reason}, unavailableReason: reason};
  }

  return {tweet: value};
}

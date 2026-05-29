import {getAuthHeaders} from "./auth";
import {TWEET_DETAIL_FEATURES, TWEET_DETAIL_QUERY_ID} from "./constants";
import {XExtractError} from "./errors";
import {isJsonObject} from "./guards";
import {fetchWithTokenAttempts, normalizeSimultaneousRequests} from "./token-attempts";
import {parseTweetId} from "./tweet-url";
import type {JsonObject} from "./types";
import {shuffleWorkaroundTokens} from "./workaround-tokens";

type ExtractStatusV2TweetDetailOptions = {
  simultaneousRequests?: number;
};

export async function extractStatusV2TweetDetail(
  input: string,
  authTokens: readonly string[],
  options: ExtractStatusV2TweetDetailOptions = {},
): Promise<JsonObject> {
  const tweetId = parseTweetId(input);
  const tokens = getTweetDetailTokens(authTokens);
  const simultaneousRequests = normalizeSimultaneousRequests(options.simultaneousRequests);

  return fetchWithTokenAttempts(tokens, simultaneousRequests, async (token) =>
    parseTweetDetail(await fetchTweetDetail(tweetId, token), tweetId),
  );
}

export async function extractStatusV2TweetDetailRaw(
  input: string,
  authTokens: readonly string[],
  options: ExtractStatusV2TweetDetailOptions = {},
): Promise<JsonObject> {
  const tweetId = parseTweetId(input);
  const tokens = getTweetDetailTokens(authTokens);
  const simultaneousRequests = normalizeSimultaneousRequests(options.simultaneousRequests);

  return fetchWithTokenAttempts(tokens, simultaneousRequests, (token) =>
    fetchTweetDetail(tweetId, token),
  );
}

function getTweetDetailTokens(authTokens: readonly string[]): string[] {
  const tokens = shuffleWorkaroundTokens(authTokens);

  if (tokens.length === 0) {
    throw new XExtractError(400, "Extract error (no tokens defined)");
  }

  return tokens;
}

async function fetchTweetDetail(tweetId: string, authToken: string): Promise<JsonObject> {
  const response = await fetch(buildTweetDetailUrl(tweetId), {
    headers: getAuthHeaders({authToken}),
  });

  if (response.status === 429) {
    throw new XExtractError(400, "Extract error: rate limit reached");
  }

  const output = await readJsonObject(response);
  if ("errors" in output) {
    throw new XExtractError(400, "Extract error");
  }

  return output;
}

function buildTweetDetailUrl(tweetId: string): string {
  const variables = {
    focalTweetId: tweetId,
    with_rux_injections: false,
    includePromotedContent: true,
    withCommunity: true,
    withQuickPromoteEligibilityTweetFields: true,
    withBirdwatchNotes: true,
    withVoice: true,
    withV2Timeline: true,
  };

  const searchParams = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(TWEET_DETAIL_FEATURES),
  });

  return `https://x.com/i/api/graphql/${TWEET_DETAIL_QUERY_ID}/TweetDetail?${searchParams}`;
}

async function readJsonObject(response: Response): Promise<JsonObject> {
  const body: unknown = await response.json();
  if (!isJsonObject(body)) {
    throw new XExtractError(400, "Extract error");
  }

  return body;
}

function parseTweetDetail(output: JsonObject, tweetId: string): JsonObject {
  const data = output.data;
  if (!isJsonObject(data)) {
    throw new XExtractError(400, "Extract error");
  }

  const conversation = data.threaded_conversation_with_injections_v2;
  if (!isJsonObject(conversation)) {
    throw new XExtractError(400, "Extract error");
  }

  const instructions = conversation.instructions;
  if (!Array.isArray(instructions)) {
    throw new XExtractError(400, "Extract error");
  }

  const entries = getTimelineEntries(instructions);
  for (const entry of entries) {
    const tweet = getTimelineEntryTweet(entry);
    if (tweet !== null && tweet.rest_id === tweetId) {
      return tweet;
    }
  }

  return {
    error:
      "Tweet not found (404); May be due to invalid tweet, changes in Twitter's API, or a protected account.",
  };
}

function getTimelineEntries(instructions: unknown[]): unknown[] {
  for (const instruction of instructions) {
    if (!isJsonObject(instruction) || instruction.type !== "TimelineAddEntries") {
      continue;
    }

    const entries = instruction.entries;
    if (Array.isArray(entries)) {
      return entries;
    }
  }

  throw new XExtractError(400, "Extract error");
}

function getTimelineEntryTweet(entry: unknown): JsonObject | null {
  if (!isJsonObject(entry)) {
    return null;
  }

  const content = entry.content;
  if (!isJsonObject(content) || content.__typename !== "TimelineTimelineItem") {
    return null;
  }

  const itemContent = content.itemContent;
  if (!isJsonObject(itemContent) || itemContent.__typename !== "TimelineTweet") {
    return null;
  }

  const tweetResults = itemContent.tweet_results;
  if (!isJsonObject(tweetResults)) {
    return null;
  }

  return unwrapTweetResult(tweetResults.result);
}

function unwrapTweetResult(result: unknown): JsonObject | null {
  if (!isJsonObject(result)) {
    return null;
  }

  if (result.__typename === "TweetWithVisibilityResults") {
    const tweet = result.tweet;
    return isJsonObject(tweet) ? tweet : null;
  }

  if (result.__typename === "TweetUnavailable") {
    return null;
  }

  if (result.__typename !== undefined && result.__typename !== "Tweet") {
    return null;
  }

  return result;
}

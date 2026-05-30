import {getAuthHeaders} from "./auth";
import {
  ANDROID_CONVERSATION_TIMELINE_V2_FEATURES,
  ANDROID_CONVERSATION_TIMELINE_V2_QUERY_ID,
  ANDROID_REQUEST_USER_AGENT,
  ANDROID_TWITTER_BEARER,
} from "./constants";
import {XExtractError} from "./errors";
import {isJsonObject} from "./guards";
import {fetchWithTokenAttempts, normalizeSimultaneousRequests} from "./token-attempts";
import {parseTweetId} from "./tweet-url";
import type {JsonObject} from "./types";
import {shuffleWorkaroundTokens} from "./workaround-tokens";

type ExtractStatusV2AndroidOptions = {
  simultaneousRequests?: number;
};

export async function extractStatusV2Android(
  input: string,
  authTokens: readonly string[],
  options: ExtractStatusV2AndroidOptions = {},
): Promise<JsonObject> {
  const tweetId = parseTweetId(input);
  const tokens = shuffleWorkaroundTokens(authTokens);

  if (tokens.length === 0) {
    throw new XExtractError(401, "unauthorized", "No auth tokens configured.");
  }

  const simultaneousRequests = normalizeSimultaneousRequests(options.simultaneousRequests);
  return fetchWithTokenAttempts(tokens, simultaneousRequests, (token) =>
    fetchConversationTimelineV2(tweetId, token),
  );
}

// HELPERS

async function fetchConversationTimelineV2(
  tweetId: string,
  authToken: string,
): Promise<JsonObject> {
  const response = await fetch(buildConversationTimelineV2Url(tweetId), {
    headers: getAuthHeaders({
      authToken,
      bearerToken: ANDROID_TWITTER_BEARER,
      userAgent: ANDROID_REQUEST_USER_AGENT,
    }),
  });

  if (response.status === 429) {
    throw new XExtractError(429, "rate_limited", "X rate limit reached. Try again later.");
  }

  const output = await readJsonObject(response);
  if ("errors" in output) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  return parseConversationTimelineV2(output, tweetId);
}

function buildConversationTimelineV2Url(tweetId: string): string {
  const variables = {
    referrer: "home",
    includeTweetImpression: true,
    includeHasBirdwatchNotes: false,
    isReaderMode: false,
    includeEditPerspective: false,
    includeEditControl: true,
    focalTweetId: tweetId,
    includeCommunityTweetRelationship: true,
    includeTweetVisibilityNudge: true,
  };

  const searchParams = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(ANDROID_CONVERSATION_TIMELINE_V2_FEATURES),
  });

  return `https://x.com/i/api/graphql/${ANDROID_CONVERSATION_TIMELINE_V2_QUERY_ID}/ConversationTimelineV2?${searchParams}`;
}

async function readJsonObject(response: Response): Promise<JsonObject> {
  const body: unknown = await response.json();
  if (!isJsonObject(body)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  return body;
}

function parseConversationTimelineV2(output: JsonObject, tweetId: string): JsonObject {
  const data = output.data;
  if (!isJsonObject(data)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  const timelineResponse = data.timeline_response;
  if (!isJsonObject(timelineResponse)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  const instructions = timelineResponse.instructions;
  if (!Array.isArray(instructions)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
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
    if (!isJsonObject(instruction) || instruction.__typename !== "TimelineAddEntries") {
      continue;
    }

    const entries = instruction.entries;
    if (Array.isArray(entries)) {
      return entries;
    }
  }

  throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
}

function getTimelineEntryTweet(entry: unknown): JsonObject | null {
  if (!isJsonObject(entry)) {
    return null;
  }

  const content = entry.content;
  if (!isJsonObject(content) || content.__typename !== "TimelineTimelineItem") {
    return null;
  }

  const timelineContent = content.content;
  if (!isJsonObject(timelineContent) || timelineContent.__typename !== "TimelineTweet") {
    return null;
  }

  const tweetResult = timelineContent.tweetResult;
  if (!isJsonObject(tweetResult)) {
    return null;
  }

  const result = tweetResult.result;
  if (!isJsonObject(result) || result.__typename !== "Tweet") {
    return null;
  }

  return result;
}

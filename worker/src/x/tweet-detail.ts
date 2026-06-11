import {getAuthHeaders} from "./auth";
import {
  TWEET_DETAIL_FEATURES,
  TWEET_DETAIL_QUERY_ID,
  TWEET_RESULT_BY_REST_ID_FIELD_TOGGLES,
} from "./constants";
import {XExtractError} from "./errors";
import {isJsonObject} from "./guards";
import {fetchWithTokenAttempts, normalizeSimultaneousRequests} from "./token-attempts";
import {parseTweetId} from "./tweet-url";
import type {JsonObject} from "./types";
import {shuffleWorkaroundTokens} from "./workaround-tokens";

type ExtractStatusV2TweetDetailOptions = {
  simultaneousRequests?: number;
  language?: string;
};

export type ReplyChainResult = JsonObject & {
  tweet: JsonObject;
  reply_chain: JsonObject[];
  reply_chain_complete: boolean;
  missing_reply_to_status_id?: string;
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
    parseTweetDetail(await fetchTweetDetail(tweetId, token, options.language), tweetId),
  );
}

export async function extractStatusV2TweetDetailChain(
  input: string,
  authTokens: readonly string[],
  options: ExtractStatusV2TweetDetailOptions = {},
  fallbackTweet?: JsonObject,
): Promise<ReplyChainResult> {
  const tweetId = parseTweetId(input);
  const tokens = getTweetDetailTokens(authTokens);
  const simultaneousRequests = normalizeSimultaneousRequests(options.simultaneousRequests);

  return fetchWithTokenAttempts(tokens, simultaneousRequests, async (token) =>
    parseTweetDetailChain(
      await fetchTweetDetail(tweetId, token, options.language),
      tweetId,
      fallbackTweet,
    ),
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
    fetchTweetDetail(tweetId, token, options.language),
  );
}

function getTweetDetailTokens(authTokens: readonly string[]): string[] {
  const tokens = shuffleWorkaroundTokens(authTokens);

  if (tokens.length === 0) {
    throw new XExtractError(401, "unauthorized", "No auth tokens configured.");
  }

  return tokens;
}

async function fetchTweetDetail(
  tweetId: string,
  authToken: string,
  language?: string,
): Promise<JsonObject> {
  const response = await fetch(buildTweetDetailUrl(tweetId), {
    headers: getAuthHeaders({authToken, language}),
  });

  if (response.status === 429) {
    throw new XExtractError(429, "rate_limited", "X rate limit reached. Try again later.");
  }

  const output = await readJsonObject(response);
  if ("errors" in output) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
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
    fieldToggles: JSON.stringify(TWEET_RESULT_BY_REST_ID_FIELD_TOGGLES),
  });

  return `https://x.com/i/api/graphql/${TWEET_DETAIL_QUERY_ID}/TweetDetail?${searchParams}`;
}

async function readJsonObject(response: Response): Promise<JsonObject> {
  const body: unknown = await response.json();
  if (!isJsonObject(body)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  return body;
}

function parseTweetDetail(output: JsonObject, tweetId: string): JsonObject {
  const tweets = collectTweetDetailTweets(output);

  for (const tweet of tweets) {
    if (getTweetId(tweet) === tweetId) {
      return tweet;
    }
  }

  return createTweetNotFoundResult();
}

export function parseTweetDetailChain(
  output: JsonObject,
  tweetId: string,
  fallbackTweet?: JsonObject,
): ReplyChainResult {
  const tweets = collectTweetDetailTweets(output);
  const tweetsById = buildTweetsById(tweets);
  const fallbackTweetId = fallbackTweet ? getTweetId(fallbackTweet) : null;

  if (fallbackTweet && fallbackTweetId && !tweetsById.has(fallbackTweetId)) {
    tweetsById.set(fallbackTweetId, fallbackTweet);
  }

  const focalTweet = tweetsById.get(tweetId);
  if (!focalTweet) {
    return {
      tweet: fallbackTweet ?? createTweetNotFoundResult(),
      reply_chain: [],
      reply_chain_complete: false,
    };
  }

  const chain = buildReplyChain(focalTweet, tweetsById);

  return {
    tweet: focalTweet,
    reply_chain: chain.ancestors,
    reply_chain_complete: chain.complete,
    ...(chain.missingReplyToStatusId
      ? {missing_reply_to_status_id: chain.missingReplyToStatusId}
      : {}),
  };
}

function collectTweetDetailTweets(output: JsonObject): JsonObject[] {
  const data = output.data;
  if (!isJsonObject(data)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  const conversation = data.threaded_conversation_with_injections_v2;
  if (!isJsonObject(conversation)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  const instructions = conversation.instructions;
  if (!Array.isArray(instructions)) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  const entries = getTimelineEntries(instructions);
  const tweets: JsonObject[] = [];

  for (const entry of entries) {
    tweets.push(...getTimelineEntryTweets(entry));
  }

  return tweets;
}

function createTweetNotFoundResult(): JsonObject {
  return {
    error:
      "Tweet not found (404); May be due to invalid tweet, changes in Twitter's API, or a protected account.",
  };
}

function getTimelineEntries(instructions: unknown[]): unknown[] {
  const timelineEntries: unknown[] = [];

  for (const instruction of instructions) {
    if (!isJsonObject(instruction) || instruction.type !== "TimelineAddEntries") {
      continue;
    }

    const entries = instruction.entries;
    if (Array.isArray(entries)) {
      timelineEntries.push(...entries);
    }
  }

  if (timelineEntries.length === 0) {
    throw new XExtractError(502, "upstream_error", "Unexpected response from X.");
  }

  return timelineEntries;
}

function getTimelineEntryTweets(entry: unknown): JsonObject[] {
  if (!isJsonObject(entry)) {
    return [];
  }

  const content = entry.content;
  if (!isJsonObject(content)) {
    return [];
  }

  if (content.__typename === "TimelineTimelineItem") {
    const tweet = getTimelineTweet(content.itemContent);
    return tweet ? [tweet] : [];
  }

  if (content.__typename === "TimelineTimelineModule") {
    return getTimelineModuleTweets(content);
  }

  return [];
}

function getTimelineModuleTweets(content: JsonObject): JsonObject[] {
  const items = content.items;
  if (!Array.isArray(items)) {
    return [];
  }

  const tweets: JsonObject[] = [];
  for (const item of items) {
    if (!isJsonObject(item)) {
      continue;
    }

    const timelineItem = item.item;
    if (!isJsonObject(timelineItem)) {
      continue;
    }

    const tweet = getTimelineTweet(timelineItem.itemContent);
    if (tweet) {
      tweets.push(tweet);
    }
  }

  return tweets;
}

function getTimelineTweet(itemContent: unknown): JsonObject | null {
  if (!isJsonObject(itemContent) || itemContent.__typename !== "TimelineTweet") {
    return null;
  }

  const tweetResults = itemContent.tweet_results;
  if (!isJsonObject(tweetResults)) {
    return null;
  }

  return unwrapTweetResult(tweetResults.result);
}

function buildTweetsById(tweets: JsonObject[]): Map<string, JsonObject> {
  const tweetsById = new Map<string, JsonObject>();

  for (const tweet of tweets) {
    const id = getTweetId(tweet);
    if (id && !tweetsById.has(id)) {
      tweetsById.set(id, tweet);
    }
  }

  return tweetsById;
}

function buildReplyChain(
  focalTweet: JsonObject,
  tweetsById: Map<string, JsonObject>,
): {ancestors: JsonObject[]; complete: boolean; missingReplyToStatusId?: string} {
  const ancestors: JsonObject[] = [];
  const seen = new Set<string>();
  let current = focalTweet;

  while (true) {
    const currentId = getTweetId(current);
    if (currentId) {
      seen.add(currentId);
    }

    const parentId = getReplyParentId(current);
    if (!parentId) {
      return {ancestors, complete: true};
    }

    if (seen.has(parentId)) {
      return {ancestors, complete: false, missingReplyToStatusId: parentId};
    }

    const parent = tweetsById.get(parentId);
    if (!parent) {
      return {ancestors, complete: false, missingReplyToStatusId: parentId};
    }

    ancestors.unshift(parent);
    current = parent;
  }
}

export function getReplyParentId(tweet: JsonObject): string | null {
  const legacy = tweet.legacy;
  if (!isJsonObject(legacy)) {
    return null;
  }

  return typeof legacy.in_reply_to_status_id_str === "string"
    ? legacy.in_reply_to_status_id_str
    : null;
}

function getTweetId(tweet: JsonObject): string | null {
  if (typeof tweet.rest_id === "string") {
    return tweet.rest_id;
  }

  if (typeof tweet.id_str === "string") {
    return tweet.id_str;
  }

  if (typeof tweet.id === "string") {
    return tweet.id;
  }

  return null;
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

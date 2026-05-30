import {XExtractError} from "./errors";
import {extractStatus} from "./extract-status";
import {extractStatusV2Android} from "./tweet-conversation-timeline-v2-android";
import {extractStatusV2Rest} from "./tweet-result-by-rest-id";
import {extractStatusV2TweetDetail, extractStatusV2TweetDetailRaw} from "./tweet-detail";
import {extractStatusV2} from "./tweet-results-by-ids";
import {extractStatusSyndication} from "./tweet-syndication";
import type {JsonObject} from "./types";

const STATUS_METHODS = [
  "rest-guest",
  "rest-auth",
  "v2",
  "android",
  "tweet-detail",
  "syndication",
] as const;

export type StatusMethod = (typeof STATUS_METHODS)[number];

export function isStatusMethod(value: string): value is StatusMethod {
  return (STATUS_METHODS as readonly string[]).includes(value);
}

type ExtractStatusByMethodOptions = {
  authTokens: readonly string[];
  simultaneousRequests?: number;
  tweetDetailMode?: "parsed" | "raw";
};

export async function extractStatusByMethod(
  input: string,
  method: StatusMethod | undefined,
  options: ExtractStatusByMethodOptions,
): Promise<JsonObject> {
  const {authTokens, simultaneousRequests, tweetDetailMode = "raw"} = options;

  switch (method) {
    case undefined:
      return extractStatus(input, {authTokens, simultaneousRequests});
    case "rest-guest":
      logStatusMethod("rest-guest");
      return extractStatusV2Rest(input, []);
    case "rest-auth":
      if (authTokens.length === 0) {
        throw new XExtractError(401, "unauthorized", "No auth tokens configured.");
      }
      logStatusMethod("rest-auth");
      return extractStatusV2Rest(input, authTokens);
    case "v2":
      logStatusMethod("v2");
      return extractStatusV2(input, authTokens, {simultaneousRequests});
    case "android":
      logStatusMethod("android");
      return extractStatusV2Android(input, authTokens, {simultaneousRequests});
    case "tweet-detail":
      logStatusMethod("tweet-detail");
      if (tweetDetailMode === "parsed") {
        return extractStatusV2TweetDetail(input, authTokens, {simultaneousRequests});
      }
      return extractStatusV2TweetDetailRaw(input, authTokens, {simultaneousRequests});
    case "syndication":
      logStatusMethod("syndication");
      return extractStatusSyndication(input);
    default:
      throw new XExtractError(400, "invalid_input", "Invalid method query parameter.");
  }
}

function logStatusMethod(method: StatusMethod): void {
  console.log(`fetching status using ${method} method`);
}

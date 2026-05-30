import type {ContentfulStatusCode} from "hono/utils/http-status";

export type ErrorKind =
  | "rate_limited" // upstream 429 — back off and retry
  | "not_found" // tweet does not exist or is protected
  | "unauthorized" // no auth tokens configured on the server
  | "invalid_input" // bad URL or parameter from the caller
  | "upstream_error"; // unexpected response from X/Twitter

export class XExtractError extends Error {
  constructor(
    readonly code: ContentfulStatusCode,
    readonly kind: ErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "XExtractError";
  }
}

import {XExtractError} from "./errors";

// Patterns:
//  - Numeric tweet ID (min 2, max 20 digits)
//  - X/Twitter status URLs like `/user/status/1234567890` and `/user/statuses/1234567890` (legacy URL format).
const TWEET_ID_PATTERN = /^\d{2,20}$/;
const TWEET_URL_PATTERN = /(?:^|\/)@?\w{1,15}\/(?:status|statuses)\/(\d{2,20})(?:[/?#]|$)/;

/**
 * Extracts and returns the tweet ID from a given input string.
 *
 * Accepts:
 *   - Direct numeric tweet ID (as a string)
 *   - X/Twitter post URLs in common forms
 *
 * Throws:
 *   - TwExtractError if unable to extract a valid tweet ID
 */
export function parseTweetId(input: string): string {
  const trimmed = input.trim();

  // Direct numeric ID case
  if (TWEET_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  // Try to match a status URL pattern
  const match = trimmed.match(TWEET_URL_PATTERN);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback: unable to extract
  throw new XExtractError(400, "Extract error: could not parse tweet ID from input");
}

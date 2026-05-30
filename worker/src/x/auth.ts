import {GUEST_ACTIVATE_BEARER, REQUEST_USER_AGENT, TWITTER_HOST} from "./constants";
import {XExtractError} from "./errors";
import {isJsonObject} from "./guards";

const GUEST_TOKEN_PATTERN = /document\.cookie="gt=([^;]+);/;
const MAX_GUEST_TOKEN_USES = 40;

let cachedGuestToken: string | null = null;
let cachedGuestTokenUses = 0;

type AuthHeaderOptions = {
  authToken?: string;
  guestToken?: string;
  bearerToken?: string;
  userAgent?: string;
};

/**
 * Shared auth headers for all fetchers.
 *
 * - Default path (Rest/web): omit bearerToken + userAgent => web defaults.
 * - Android path (ConversationTimelineV2): pass ANDROID bearer + Android User-Agent.
 * - guestToken is only needed by guest-token/anon methods.
 */
export function getAuthHeaders(options: AuthHeaderOptions): HeadersInit {
  const csrfToken = crypto.randomUUID().replaceAll("-", "");
  const headers: Record<string, string> = {
    Authorization: options.bearerToken ?? GUEST_ACTIVATE_BEARER,
    "User-Agent": options.userAgent ?? REQUEST_USER_AGENT,
    "x-csrf-token": csrfToken,
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "en",
  };

  if (options.authToken) {
    headers.Cookie = `auth_token=${options.authToken}; ct0=${csrfToken}; `;
    headers["x-twitter-auth-type"] = "OAuth2Session";
  }

  if (options.guestToken) {
    headers["x-guest-token"] = options.guestToken;
  }

  return headers;
}

// Guest token helpers are used by guest/anon methods (e.g. RestId anon path),
// not by ConversationTimelineV2 Android.
export async function getGuestToken(): Promise<string> {
  if (cachedGuestToken !== null) {
    cachedGuestTokenUses += 1;

    if (cachedGuestTokenUses <= MAX_GUEST_TOKEN_USES) {
      return cachedGuestToken;
    }

    const previousGuestToken = cachedGuestToken;
    cachedGuestToken = null;
    cachedGuestTokenUses = 0;
    return previousGuestToken;
  }

  cachedGuestToken = await fetchGuestToken();

  cachedGuestTokenUses = 0;
  return cachedGuestToken;
}

// Fetch a guest token from the Twitter API
async function fetchGuestToken(): Promise<string> {
  // 1 try - getting the guest token from the home page

  const homeResponse = await fetch(`https://${TWITTER_HOST}`, {
    headers: {
      // make the request look like a normal browser request
      Cookie: "night_mode=2",
      "User-Agent": REQUEST_USER_AGENT,
    },
    redirect: "manual",
  });
  const homeText = await homeResponse.text();
  const homeMatch = homeText.match(GUEST_TOKEN_PATTERN);

  if (homeMatch?.[1]) {
    return homeMatch[1];
  }

  // 2 try - getting the guest token from the activate endpoint
  const activateResponse = await fetch(`https://api.${TWITTER_HOST}/1.1/guest/activate.json`, {
    method: "POST",
    headers: {
      Authorization: GUEST_ACTIVATE_BEARER,
    },
  });

  const body: unknown = await activateResponse.json();
  if (!isJsonObject(body) || typeof body.guest_token !== "string") {
    throw new XExtractError(502, "upstream_error", "Failed to obtain a guest token from X.");
  }

  return body.guest_token;
}

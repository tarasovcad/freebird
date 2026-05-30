import {Hono, Context} from "hono";
import {XExtractError} from "./x/errors";
import {simplifyStatusResponse, isReplyChainResult} from "./x/simplify-status-response";
import {extractStatusByMethod, isStatusMethod} from "./x/status-method";
import {parseWorkaroundTokens} from "./x/workaround-tokens";
import type {JsonObject} from "./x/types";

type Bindings = {
  VXTWITTER_WORKAROUND_TOKENS?: string;
  RATE_LIMIT_BURST: RateLimit;
  RATE_LIMIT_PER_IP: RateLimit;
};
// Access environment bindings through the Hono context's env property
const app = new Hono<{Bindings: Bindings}>();

const STATUS_CACHE_TTL_SECONDS = 60;
const STATUS_NOT_FOUND_CACHE_TTL_SECONDS = 30;

const statusHandler = async (c: Context<{Bindings: Bindings}>) => {
  const cache = caches.default;
  const cacheKey = new Request(c.req.url, {method: "GET"});
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Rate limiting: check burst limit first (fast fail)
  const ip = c.req.header("cf-connecting-ip") || "unknown";

  const burstCheck = await c.env.RATE_LIMIT_BURST.limit({key: ip});
  if (!burstCheck.success) {
    return c.json(
      {
        error: "Too many requests. Please slow down.",
        kind: "rate_limit_exceeded",
        retry_after: 10,
      },
      429,
    );
  }

  // Check per-minute rate limit
  const perMinCheck = await c.env.RATE_LIMIT_PER_IP.limit({key: ip});
  if (!perMinCheck.success) {
    return c.json(
      {
        error: "Rate limit exceeded. Maximum 30 requests per minute.",
        kind: "rate_limit_exceeded",
        retry_after: 60,
      },
      429,
    );
  }

  const url = c.req.param("url") || c.req.query("url");
  const methodParam = c.req.param("method") || c.req.query("method");
  const formatParam = c.req.param("format") || c.req.query("format");

  if (!url) {
    return c.json({error: "Missing url parameter.", kind: "invalid_input"}, 400);
  }

  try {
    const authTokens = parseWorkaroundTokens(c.env.VXTWITTER_WORKAROUND_TOKENS);

    if (methodParam && !isStatusMethod(methodParam)) {
      return c.json({error: "Invalid method parameter.", kind: "invalid_input"}, 400);
    }

    const format = parseResponseFormat(formatParam);
    if (!format) {
      return c.json({error: "Invalid format parameter.", kind: "invalid_input"}, 400);
    }

    const method = methodParam && isStatusMethod(methodParam) ? methodParam : undefined;
    const tweetDetailMode = method === "tweet-detail" && format === "simple" ? "parsed" : "raw";
    const status = await extractStatusByMethod(url, method, {
      authTokens,
      simultaneousRequests: 2,
      tweetDetailMode,
    });

    const resolveTweet = async (tweetUrl: string): Promise<JsonObject | null> => {
      try {
        const resolvedStatus = await extractStatusByMethod(tweetUrl, method, {
          authTokens,
          simultaneousRequests: 2,
          tweetDetailMode,
        });

        return isReplyChainResult(resolvedStatus) ? resolvedStatus.tweet : resolvedStatus;
      } catch (error) {
        if (error instanceof XExtractError) {
          return null;
        }

        throw error;
      }
    };

    const payload =
      format === "simple" ? await simplifyStatusResponse(status, resolveTweet) : status;
    const response = c.json(payload);

    if (response.status === 200) {
      response.headers.set(
        "Cache-Control",
        `public, max-age=60, s-maxage=${STATUS_CACHE_TTL_SECONDS}`,
      );
      await cache.put(cacheKey, response.clone());
    } else if (response.status === 404) {
      response.headers.set(
        "Cache-Control",
        `public, max-age=0, s-maxage=${STATUS_NOT_FOUND_CACHE_TTL_SECONDS}`,
      );
      await cache.put(cacheKey, response.clone());
    }

    return response;
  } catch (error) {
    if (error instanceof XExtractError) {
      return c.json({error: error.message, kind: error.kind}, error.code);
    }

    return c.json({error: "Internal server error.", kind: "upstream_error"}, 500);
  }
};

app.get("/status", statusHandler);
app.get("/status/:url", statusHandler);
app.get("/status/:url/format/:format", statusHandler);
app.get("/status/:url/method/:method", statusHandler);
app.get("/status/:url/method/:method/format/:format", statusHandler);
app.get("/status/:url/format/:format/method/:method", statusHandler);

function parseResponseFormat(value?: string): "full" | "simple" | null {
  if (!value) {
    return "full";
  }

  switch (value) {
    case "full":
    case "raw":
      return "full";
    case "simple":
    case "simplified":
      return "simple";
    default:
      return null;
  }
}

export default app;

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

const withTiming = (response: Response, startedAt: number) => {
  const durationMs = performance.now() - startedAt;
  const headers = new Headers(response.headers);

  headers.set("Server-Timing", `total;dur=${durationMs.toFixed(2)}`);
  headers.set("X-Response-Time-Ms", durationMs.toFixed(2));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const statusHandler = async (c: Context<{Bindings: Bindings}>) => {
  const startedAt = performance.now();
  const cache = caches.default;
  const cacheKey = new Request(c.req.url, {method: "GET"});
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return withTiming(cachedResponse, startedAt);
  }

  // Rate limiting: check burst limit first (fast fail)
  const ip = c.req.header("cf-connecting-ip") || "unknown";

  const burstCheck = await c.env.RATE_LIMIT_BURST.limit({key: ip});
  if (!burstCheck.success) {
    return withTiming(
      c.json(
        {
          error: "Too many requests. Please slow down.",
          kind: "rate_limit_exceeded",
          retry_after: 10,
        },
        429,
      ),
      startedAt,
    );
  }

  // Check per-minute rate limit
  const perMinCheck = await c.env.RATE_LIMIT_PER_IP.limit({key: ip});
  if (!perMinCheck.success) {
    return withTiming(
      c.json(
        {
          error: "Rate limit exceeded. Maximum 30 requests per minute.",
          kind: "rate_limit_exceeded",
          retry_after: 60,
        },
        429,
      ),
      startedAt,
    );
  }

  const url = c.req.param("url") || c.req.query("url");
  const methodParam = c.req.param("method") || c.req.query("method");
  const formatParam = c.req.param("format") || c.req.query("format");

  if (!url) {
    return withTiming(
      c.json({error: "Missing url parameter.", kind: "invalid_input"}, 400),
      startedAt,
    );
  }

  try {
    const authTokens = parseWorkaroundTokens(c.env.VXTWITTER_WORKAROUND_TOKENS);

    if (methodParam && !isStatusMethod(methodParam)) {
      return withTiming(
        c.json({error: "Invalid method parameter.", kind: "invalid_input"}, 400),
        startedAt,
      );
    }

    const format = parseResponseFormat(formatParam);
    if (!format) {
      return withTiming(
        c.json({error: "Invalid format parameter.", kind: "invalid_input"}, 400),
        startedAt,
      );
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

    return withTiming(response, startedAt);
  } catch (error) {
    if (error instanceof XExtractError) {
      return withTiming(c.json({error: error.message, kind: error.kind}, error.code), startedAt);
    }

    return withTiming(
      c.json({error: "Internal server error.", kind: "upstream_error"}, 500),
      startedAt,
    );
  }
};

app.get("/favicon.ico", (c) => c.redirect("/favicon.png", 301));

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

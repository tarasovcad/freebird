import {Hono, Context} from "hono";
import {XExtractError} from "./x/errors";
import {simplifyStatusResponse, isReplyChainResult} from "./x/simplify-status-response";
import {extractStatusByMethod, isStatusMethod} from "./x/status-method";
import {parseWorkaroundTokens} from "./x/workaround-tokens";
import type {JsonObject} from "./x/types";

type Bindings = {
  VXTWITTER_WORKAROUND_TOKENS?: string;
};
// Access environment bindings through the Hono context's env property
const app = new Hono<{Bindings: Bindings}>();

const statusHandler = async (c: Context<{Bindings: Bindings}>) => {
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

    const response =
      format === "simple" ? await simplifyStatusResponse(status, resolveTweet) : status;
    return c.json(response);
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

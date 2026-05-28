import {Hono} from "hono";
import {XExtractError} from "./x/errors";
import {extractStatus} from "./x/extract-status";
import {parseWorkaroundTokens} from "./x/workaround-tokens";

type Bindings = {
  VXTWITTER_WORKAROUND_TOKENS?: string;
};
// Access environment bindings through the Hono context's env property
const app = new Hono<{Bindings: Bindings}>();

app.get("/status", async (c) => {
  const url = c.req.query("url");

  if (!url) {
    return c.json({error: "Missing url query parameter"}, 400);
  }

  try {
    const authTokens = parseWorkaroundTokens(c.env.VXTWITTER_WORKAROUND_TOKENS);
    const tweet = await extractStatus(url, {authTokens, simultaneousRequests: 2});
    return c.json(tweet);
  } catch (error) {
    if (error instanceof XExtractError) {
      return c.json({error: error.message, code: error.code}, 400);
    }

    return c.json({error: "Internal server error"}, 500);
  }
});

export default app;

import {Hono} from "hono";
import {XExtractError} from "./x/errors";
import {fixTweetData} from "./x/fix-tweet-data";
// import {extractStatusV2Rest} from "./x/tweet-result-by-rest-id";
import {extractStatusV2} from "./x/tweet-results-by-ids";
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
    // const tweet = await extractStatusV2Rest(url, authTokens);
    const tweet = await extractStatusV2(url, authTokens, {simultaneousRequests: 2});
    return c.json(fixTweetData(tweet));
  } catch (error) {
    if (error instanceof XExtractError) {
      return c.json({error: error.message, code: error.code}, 400);
    }

    return c.json({error: "Internal server error"}, 500);
  }
});

export default app;

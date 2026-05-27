import {Hono} from "hono";
import {XExtractError} from "./x/errors";
import {fixTweetData} from "./x/fix-tweet-data";
import {extractStatusV2Rest} from "./x/tweet-result-by-rest-id";

const app = new Hono();

app.get("/status", async (c) => {
  const url = c.req.query("url");

  if (!url) {
    return c.json({error: "Missing url query parameter"}, 400);
  }

  try {
    const tweet = await extractStatusV2Rest(url);
    return c.json(fixTweetData(tweet));
  } catch (error) {
    if (error instanceof XExtractError) {
      return c.json({error: error.message, code: error.code}, 400);
    }

    return c.json({error: "Internal server error"}, 500);
  }
});

export default app;

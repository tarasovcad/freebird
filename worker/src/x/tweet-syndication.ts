import {XExtractError} from "./errors";
import {isJsonObject} from "./guards";
import {parseTweetId} from "./tweet-url";
import type {JsonObject} from "./types";
import {SYNDICATION_URL} from "./constants";

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

export async function extractStatusSyndication(input: string): Promise<JsonObject> {
  const tweetId = parseTweetId(input);
  const token = calcSyndicationToken(tweetId);
  const response = await fetch(`${SYNDICATION_URL}?id=${tweetId}&token=${token}`);

  if (response.status === 404) {
    throw new XExtractError(404, "Tweet not found");
  }

  const output = await readJsonObject(response);

  if ("errors" in output) {
    throw getSyndicationError(output.errors);
  }

  normalizeSyndicationTweet(output);
  return output;
}

async function readJsonObject(response: Response): Promise<JsonObject> {
  return response.json().then((body: unknown) => {
    if (!isJsonObject(body)) {
      throw new XExtractError(400, "Extract error");
    }

    return body;
  });
}

function getSyndicationError(errors: unknown): XExtractError {
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0];
    if (isJsonObject(first)) {
      const code = typeof first.code === "number" ? first.code : 400;
      const message = typeof first.message === "string" ? first.message : "Extract error";
      return new XExtractError(code, message);
    }
  }

  return new XExtractError(400, "Extract error");
}

function normalizeSyndicationTweet(output: JsonObject): void {
  if (typeof output.text === "string") {
    output.full_text = output.text;
  }

  const user = output.user;
  if (isJsonObject(user) && typeof user.profile_image_url_https === "string") {
    user.profile_image_url = user.profile_image_url_https;
  }

  output.retweet_count = 0;

  const mediaDetails = output.mediaDetails;
  if (Array.isArray(mediaDetails)) {
    output.extended_entities = {media: mediaDetails};
    for (const media of mediaDetails) {
      if (isJsonObject(media) && typeof media.media_url_https === "string") {
        media.media_url = media.media_url_https;
      }
    }
  }

  const quotedTweet = output.quoted_tweet;
  if (isJsonObject(quotedTweet)) {
    output.quoted_status = quotedTweet;
    const quotedId = typeof quotedTweet.id_str === "string" ? quotedTweet.id_str : null;
    const quotedUser = quotedTweet.user;
    const quotedScreenName =
      isJsonObject(quotedUser) && typeof quotedUser.screen_name === "string"
        ? quotedUser.screen_name
        : null;

    if (quotedId && quotedScreenName) {
      output.quoted_status_permalink = {
        expanded: `https://x.com/${quotedScreenName}/status/${quotedId}`,
      };
    }
  }
}

function calcSyndicationToken(id: string): string {
  const scaled = (Number(id) / 1_000_000_000_000_000) * Math.PI;
  const converted = baseConversion(scaled, 36);
  const cleaned = converted.replaceAll("0", "").replaceAll(".", "");

  return cleaned.length === 0 ? "0" : cleaned;
}

function baseConversion(value: number, base: number): string {
  let result = "";
  let integer = Math.floor(value);

  while (integer > 0) {
    result = DIGITS[integer % base] + result;
    integer = Math.floor(integer / base);
  }

  if (Math.floor(value) !== value) {
    result += ".";
    let fraction = value - Math.floor(value);
    let digits = 0;

    while (fraction !== Math.floor(fraction)) {
      result += DIGITS[Math.floor((fraction * base) % base)];
      fraction *= base;
      digits += 1;

      if (digits >= 8) {
        break;
      }
    }
  }

  return result;
}

import {isJsonObject} from "./guards";
import type {JsonObject} from "./types";

export function fixTweetData(tweet: JsonObject): JsonObject {
  if (!("user" in tweet)) {
    const user = getLegacyUser(tweet);
    if (user !== null) {
      tweet.user = user;
    }
  }

  if (!("extended_entities" in tweet)) {
    const legacy = tweet.legacy;
    if (isJsonObject(legacy) && "extended_entities" in legacy) {
      tweet.extended_entities = legacy.extended_entities;
    }
  }

  return tweet;
}

function getLegacyUser(tweet: JsonObject): JsonObject | null {
  const core = tweet.core;
  if (!isJsonObject(core)) {
    return null;
  }

  const userResults = core.user_results;
  if (!isJsonObject(userResults)) {
    return null;
  }

  const result = userResults.result;
  if (!isJsonObject(result)) {
    return null;
  }

  const legacy = result.legacy;
  return isJsonObject(legacy) ? legacy : null;
}

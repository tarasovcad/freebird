import {isJsonObject} from "./guards";
import type {JsonObject} from "./types";

type MediaExtended = {
  altText: string | null;
  aspect_ratio: [number, number] | null;
  duration_millis: number | null;
  id_str: string | null;
  size: {
    height: number | null;
    width: number | null;
  } | null;
  thumbnail_url: string | null;
  type: string | null;
  url: string | null;
};

type LinkEntity = {
  display_url: string | null;
  expanded_url: string | null;
  indices: [number, number] | null;
  url: string | null;
};

type UserMentionEntity = {
  id_str: string | null;
  indices: [number, number] | null;
  name: string | null;
  screen_name: string | null;
};

type SimplifiedTweet = {
  post: SimplifiedPost;
  metrics: SimplifiedMetrics;
  user: SimplifiedUser;
};

type SimplifiedPost = {
  allSameType: boolean;
  article: JsonObject | null;
  combinedMediaUrl: null;
  communityNote: null;
  conversationID: string | null;
  date: string | null;
  date_epoch: number | null;
  display_text_range: [number, number] | null;
  entities: {
    urls: LinkEntity[];
    user_mentions: UserMentionEntity[];
  };
  fetched_on: number;
  hasMedia: boolean;
  hashtags: string[];
  lang: string | null;
  mediaURLs: string[];
  media_extended: MediaExtended[];
  pollData: null;
  possibly_sensitive: boolean | null;
  qrt: SimplifiedQuotedTweet | null;
  qrtURL: string | null;
  replyingTo: string | null;
  replyingToID: string | null;
  retweet: null;
  retweetURL: null;
  text: string | null;
  translation: null;
  tweetID: string | null;
  tweetURL: string | null;
};

type SimplifiedMetrics = {
  likes: number | null;
  replies: number | null;
  retweets: number | null;
};

type UserVerification = {
  verified_type: string | null;
};

type SimplifiedUser = {
  user_name: string | null;
  user_profile_image_url: string | null;
  user_screen_name: string | null;
  is_blue_verified: boolean | null;
  verification: UserVerification;
  affiliates_highlighted_label: AffiliateLabel | null;
};

type SimplifiedQuotedTweet = {
  post: SimplifiedPost;
  metrics: SimplifiedMetrics;
  user: SimplifiedUser;
};

type AffiliateLabel = {
  badge_url: string | null;
  description: string | null;
  url: string | null;
  userLabelDisplayType: string | null;
  userLabelType: string | null;
};

export function simplifyTweet(tweet: JsonObject): JsonObject {
  return simplifyTweetInternal(tweet, createSimplifyTweetOptions(true));
}

export async function simplifyTweetWithResolvedTweets(
  tweet: JsonObject,
  resolveTweet: (url: string) => Promise<JsonObject | null>,
): Promise<JsonObject> {
  const options = createSimplifyTweetOptions(true);
  const simplified = simplifyTweetInternal(tweet, options);

  if (!simplified.post.qrt && simplified.post.qrtURL) {
    const quotedTweet = await resolveTweet(simplified.post.qrtURL);
    if (quotedTweet) {
      simplified.post.qrt = flattenQuotedTweet(
        simplifyTweetInternal(quotedTweet, {...options, includeQuotedTweet: false}),
      );
    }
  }

  return simplified;
}

function createSimplifyTweetOptions(includeQuotedTweet: boolean): SimplifyTweetOptions {
  return {
    fetched_on: Math.floor(Date.now() / 1000),
    includeQuotedTweet,
  };
}

type SimplifyTweetOptions = {
  fetched_on: number;
  includeQuotedTweet: boolean;
};

function simplifyTweetInternal(tweet: JsonObject, options: SimplifyTweetOptions): SimplifiedTweet {
  const legacy = getLegacyTweet(tweet);
  const user = getUser(tweet);
  const tweetID =
    getString(legacy.id_str) ??
    getString(tweet.rest_id) ??
    getString(tweet.id_str) ??
    getString(tweet.id);

  const userScreenName = getUserScreenName(tweet, user);
  const tweetURL = tweetID && userScreenName ? buildTweetUrl(userScreenName, tweetID) : null;
  const date = getString(legacy.created_at);
  const date_epoch = date ? toEpochSeconds(date) : null;
  const quotedTweet = options.includeQuotedTweet ? getQuotedTweet(tweet, legacy) : null;

  const media_extended = getMediaExtended(legacy);
  const mediaURLs = media_extended
    .map((media) => media.url)
    .filter((url): url is string => typeof url === "string");

  const hasMedia = mediaURLs.length > 0;
  const allSameType = media_extended.length === 0 ? true : hasSingleMediaType(media_extended);

  const simplified: SimplifiedTweet = {
    post: {
      allSameType,
      article: getArticle(tweet),
      combinedMediaUrl: null,
      communityNote: null,
      conversationID: getString(legacy.conversation_id_str) ?? getString(tweet.conversation_id_str),
      date,
      date_epoch,
      display_text_range: getDisplayTextRange(legacy),
      entities: getEntities(tweet, legacy),
      fetched_on: options.fetched_on,
      hasMedia,
      hashtags: getHashtags(legacy),
      lang: getString(legacy.lang),
      mediaURLs,
      media_extended,
      pollData: null,
      possibly_sensitive: getBoolean(legacy.possibly_sensitive),
      qrt: quotedTweet
        ? flattenQuotedTweet(
            simplifyTweetInternal(quotedTweet, {...options, includeQuotedTweet: false}),
          )
        : null,
      qrtURL: getQrtUrl(legacy, tweet, quotedTweet),
      replyingTo: getString(legacy.in_reply_to_screen_name),
      replyingToID: getString(legacy.in_reply_to_status_id_str),
      retweet: null,
      retweetURL: null,
      text: getTweetText(tweet, legacy),
      translation: null,
      tweetID,
      tweetURL,
    },
    metrics: {
      likes: getNumber(legacy.favorite_count),
      replies: getNumber(legacy.reply_count),
      retweets: getNumber(legacy.retweet_count),
    },
    user: {
      user_name: getUserName(tweet, user),
      user_profile_image_url: user ? getAvatarUrl(user, tweet) : null,
      user_screen_name: userScreenName,
      is_blue_verified: getBlueVerified(tweet),
      verification: {
        verified_type: getVerificationVerifiedType(tweet),
      },
      affiliates_highlighted_label: getAffiliateLabel(tweet),
    },
  };

  return simplified;
}

function flattenQuotedTweet(tweet: SimplifiedTweet): SimplifiedQuotedTweet {
  return {
    post: tweet.post,
    metrics: tweet.metrics,
    user: tweet.user,
  };
}

function getLegacyTweet(tweet: JsonObject): JsonObject {
  const legacy = tweet.legacy;
  return isJsonObject(legacy) ? legacy : tweet;
}

function getArticle(tweet: JsonObject): JsonObject | null {
  const article = tweet.article;
  if (!isJsonObject(article)) {
    return null;
  }

  const articleResults = article.article_results;
  if (!isJsonObject(articleResults)) {
    return article;
  }

  const result = articleResults.result;
  return isJsonObject(result) ? result : article;
}

function getUser(tweet: JsonObject): JsonObject | null {
  const user = tweet.user;
  if (isJsonObject(user)) {
    return user;
  }

  const result = getUserResult(tweet);
  if (!result) {
    return null;
  }

  const legacy = result.legacy;
  return isJsonObject(legacy) ? legacy : null;
}

function getUserResult(tweet: JsonObject): JsonObject | null {
  const core = tweet.core;
  if (!isJsonObject(core)) {
    return null;
  }

  const userResults = core.user_results;
  if (!isJsonObject(userResults)) {
    return null;
  }

  const result = userResults.result;
  return isJsonObject(result) ? result : null;
}

function getUserCore(tweet: JsonObject): JsonObject | null {
  const result = getUserResult(tweet);
  if (!result) {
    return null;
  }

  const core = result.core;
  return isJsonObject(core) ? core : null;
}

function getUserName(tweet: JsonObject, user: JsonObject | null): string | null {
  return getString(user?.name) ?? getString(getUserCore(tweet)?.name);
}

function getUserScreenName(tweet: JsonObject, user: JsonObject | null): string | null {
  return getString(user?.screen_name) ?? getString(getUserCore(tweet)?.screen_name);
}

function getBlueVerified(tweet: JsonObject): boolean | null {
  const result = getUserResult(tweet);
  if (!result) {
    return null;
  }

  return getBoolean(result.is_blue_verified);
}

function getVerificationVerifiedType(tweet: JsonObject): string | null {
  const result = getUserResult(tweet);
  if (!result) {
    return null;
  }

  const verification = result.verification;
  if (!isJsonObject(verification)) {
    return null;
  }

  return getString(verification.verified_type);
}

function getAffiliateLabel(tweet: JsonObject): AffiliateLabel | null {
  const result = getUserResult(tweet);
  if (!result) {
    return null;
  }

  const affiliates = result.affiliates_highlighted_label;
  if (!isJsonObject(affiliates)) {
    return null;
  }

  const label = affiliates.label;
  if (!isJsonObject(label)) {
    return null;
  }

  const badge = label.badge;
  const urlObject = label.url;

  const affiliate: AffiliateLabel = {
    badge_url: isJsonObject(badge) ? getString(badge.url) : null,
    description: getString(label.description),
    url: isJsonObject(urlObject) ? getString(urlObject.url) : null,
    userLabelDisplayType: getString(label.userLabelDisplayType),
    userLabelType: getString(label.userLabelType),
  };

  if (
    !affiliate.badge_url &&
    !affiliate.description &&
    !affiliate.url &&
    !affiliate.userLabelDisplayType &&
    !affiliate.userLabelType
  ) {
    return null;
  }

  return affiliate;
}

function getAvatarUrl(user: JsonObject, tweet: JsonObject): string | null {
  const httpsUrl = getString(user.profile_image_url_https);
  if (httpsUrl) {
    return httpsUrl;
  }

  const httpUrl = getString(user.profile_image_url);
  if (httpUrl) {
    return httpUrl;
  }

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

  const avatar = result.avatar;
  if (!isJsonObject(avatar)) {
    return null;
  }

  return getString(avatar.image_url);
}

function getHashtags(legacy: JsonObject): string[] {
  const entities = legacy.entities;
  if (!isJsonObject(entities)) {
    return [];
  }

  const hashtags = entities.hashtags;
  if (!Array.isArray(hashtags)) {
    return [];
  }

  return hashtags
    .map((item) => (isJsonObject(item) ? getString(item.text) : null))
    .filter((tag): tag is string => typeof tag === "string");
}

function getDisplayTextRange(legacy: JsonObject): [number, number] | null {
  const range = legacy.display_text_range;
  if (
    Array.isArray(range) &&
    range.length === 2 &&
    typeof range[0] === "number" &&
    typeof range[1] === "number"
  ) {
    return [range[0], range[1]];
  }
  return null;
}

function getTweetText(tweet: JsonObject, legacy: JsonObject): string | null {
  const noteTweet = getNoteTweet(tweet);
  let text = getString(noteTweet?.text) ?? getString(legacy.full_text) ?? getString(legacy.text);

  if (!text) {
    return null;
  }

  text = removeReplyPrefix(text, getDisplayTextRange(legacy));
  text = expandTextUrls(text, getUrlEntities(legacy, noteTweet));
  text = removeMediaTextUrls(text, getMediaList(legacy));

  return text.trimEnd();
}

function removeReplyPrefix(text: string, displayTextRange: [number, number] | null): string {
  if (!displayTextRange) {
    return text;
  }

  const [start] = displayTextRange;
  if (start <= 0) {
    return text;
  }

  return text.slice(start);
}

function getNoteTweet(tweet: JsonObject): JsonObject | null {
  const noteTweet = tweet.note_tweet;
  if (!isJsonObject(noteTweet)) {
    return null;
  }

  const noteTweetResults = noteTweet.note_tweet_results;
  if (!isJsonObject(noteTweetResults)) {
    return null;
  }

  const result = noteTweetResults.result;
  return isJsonObject(result) ? result : null;
}

function getEntities(
  tweet: JsonObject,
  legacy: JsonObject,
): {urls: LinkEntity[]; user_mentions: UserMentionEntity[]} {
  const noteTweet = getNoteTweet(tweet);

  return {
    urls: getUrlEntities(legacy, noteTweet).map((urlEntity) => ({
      display_url: getString(urlEntity.display_url) ?? getString(urlEntity.display),
      expanded_url: getString(urlEntity.expanded_url) ?? getString(urlEntity.expanded),
      indices: getIndices(urlEntity.indices),
      url: getString(urlEntity.url),
    })),
    user_mentions: getUserMentionEntities(legacy, noteTweet).map((mention) => ({
      id_str: getString(mention.id_str),
      indices: getIndices(mention.indices),
      name: getString(mention.name),
      screen_name: getString(mention.screen_name),
    })),
  };
}

function getUrlEntities(legacy: JsonObject, noteTweet: JsonObject | null): JsonObject[] {
  const legacyUrls = getEntitiesList(legacy.entities, "urls");
  const noteUrls = getEntitiesList(noteTweet?.entity_set, "urls");

  return dedupeUrlEntities([...legacyUrls, ...noteUrls]);
}

function dedupeUrlEntities(urls: JsonObject[]): JsonObject[] {
  const seen = new Set<string>();
  const deduped: JsonObject[] = [];

  for (const urlEntity of urls) {
    const key = getString(urlEntity.url) ?? getString(urlEntity.expanded_url);
    if (key && seen.has(key)) {
      continue;
    }

    if (key) {
      seen.add(key);
    }
    deduped.push(urlEntity);
  }

  return deduped;
}

function getUserMentionEntities(legacy: JsonObject, noteTweet: JsonObject | null): JsonObject[] {
  const legacyMentions = getEntitiesList(legacy.entities, "user_mentions");
  const noteMentions = getEntitiesList(noteTweet?.entity_set, "user_mentions");

  return dedupeUserMentionEntities([...legacyMentions, ...noteMentions]);
}

function dedupeUserMentionEntities(mentions: JsonObject[]): JsonObject[] {
  const seen = new Set<string>();
  const deduped: JsonObject[] = [];

  for (const mention of mentions) {
    const indices = getIndices(mention.indices);
    const key = `${getString(mention.id_str) ?? getString(mention.screen_name) ?? ""}:${indices?.[0] ?? ""}:${indices?.[1] ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(mention);
  }

  return deduped;
}

function getIndices(indices: unknown): [number, number] | null {
  if (
    Array.isArray(indices) &&
    indices.length === 2 &&
    typeof indices[0] === "number" &&
    typeof indices[1] === "number"
  ) {
    return [indices[0], indices[1]];
  }

  return null;
}

function expandTextUrls(text: string, urls: JsonObject[]): string {
  let expandedText = text;

  for (const urlEntity of urls) {
    const shortUrl = getString(urlEntity.url);
    const expandedUrl = getString(urlEntity.expanded_url) ?? getString(urlEntity.expanded);

    if (!shortUrl || !expandedUrl) {
      continue;
    }

    expandedText = replaceAll(expandedText, shortUrl, expandedUrl);
  }

  return expandedText;
}

function removeMediaTextUrls(text: string, mediaList: JsonObject[] | null): string {
  if (!mediaList) {
    return text;
  }

  let cleanedText = text;
  for (const media of mediaList) {
    const mediaUrl = getString(media.url);
    if (!mediaUrl) {
      continue;
    }

    cleanedText = replaceAll(cleanedText, mediaUrl, "");
  }

  return cleanedText;
}

function getEntitiesList(entities: unknown, key: string): JsonObject[] {
  if (!isJsonObject(entities)) {
    return [];
  }

  const list = entities[key];
  if (!Array.isArray(list)) {
    return [];
  }

  return list.filter((item): item is JsonObject => isJsonObject(item));
}

function replaceAll(text: string, search: string, replacement: string): string {
  return text.split(search).join(replacement);
}

function getMediaExtended(legacy: JsonObject): MediaExtended[] {
  const mediaList = getMediaList(legacy);
  if (!mediaList) {
    return [];
  }

  return mediaList.map((media) => simplifyMedia(media));
}

function getMediaList(legacy: JsonObject): JsonObject[] | null {
  const extendedEntities = legacy.extended_entities;
  const entities = legacy.entities;

  const mediaList =
    (isJsonObject(extendedEntities) && Array.isArray(extendedEntities.media)
      ? extendedEntities.media
      : null) ?? (isJsonObject(entities) && Array.isArray(entities.media) ? entities.media : null);

  if (!Array.isArray(mediaList)) {
    return null;
  }

  return mediaList.filter((item) => isJsonObject(item)) as JsonObject[];
}

function simplifyMedia(media: JsonObject): MediaExtended {
  const type = getString(media.type);
  const originalInfo = isJsonObject(media.original_info) ? media.original_info : null;
  const sizes = isJsonObject(media.sizes) ? media.sizes : null;
  const large = sizes && isJsonObject(sizes.large) ? sizes.large : null;

  const width = getNumber(originalInfo?.width ?? large?.w);
  const height = getNumber(originalInfo?.height ?? large?.h);
  const size = width || height ? {height, width} : null;

  const url = getMediaUrl(media, type);
  const thumbnail_url =
    type === "video" || type === "animated_gif"
      ? (getString(media.media_url_https) ?? getString(media.media_url) ?? getString(media.url))
      : null;

  return {
    altText: getString(media.ext_alt_text) ?? getString(media.alt_text),
    aspect_ratio: getAspectRatio(media, width, height),
    duration_millis: getVideoDuration(media),
    id_str: getString(media.id_str),
    size,
    thumbnail_url,
    type,
    url,
  };
}

function getAspectRatio(
  media: JsonObject,
  width: number | null,
  height: number | null,
): [number, number] | null {
  const videoInfo = media.video_info;
  if (isJsonObject(videoInfo) && Array.isArray(videoInfo.aspect_ratio)) {
    const [x, y] = videoInfo.aspect_ratio;
    if (typeof x === "number" && typeof y === "number") {
      return [x, y];
    }
  }

  if (width && height) {
    return [width, height];
  }

  return null;
}

function getVideoDuration(media: JsonObject): number | null {
  const videoInfo = media.video_info;
  if (!isJsonObject(videoInfo)) {
    return null;
  }

  return getNumber(videoInfo.duration_millis);
}

function getMediaUrl(media: JsonObject, type: string | null): string | null {
  if (type === "video" || type === "animated_gif") {
    const videoInfo = media.video_info;
    if (isJsonObject(videoInfo)) {
      const variants = videoInfo.variants;
      const best = pickBestVideoVariant(variants);
      if (best) {
        return best;
      }
    }
  }

  return (
    getString(media.media_url_https) ?? getString(media.media_url) ?? getString(media.url) ?? null
  );
}

function pickBestVideoVariant(variants: unknown): string | null {
  if (!Array.isArray(variants)) {
    return null;
  }

  const mp4Variants = variants
    .filter((variant) => isJsonObject(variant))
    .map((variant) => {
      const contentType = getString(variant.content_type);
      const bitrate = getNumber(variant.bitrate);
      const url = getString(variant.url);
      return {contentType, bitrate, url};
    })
    .filter((variant) => variant.url && variant.contentType === "video/mp4");

  if (mp4Variants.length === 0) {
    const fallback = variants.find((variant) =>
      isJsonObject(variant) ? typeof variant.url === "string" : false,
    );
    return isJsonObject(fallback) ? getString(fallback.url) : null;
  }

  mp4Variants.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
  return mp4Variants[0]?.url ?? null;
}

function hasSingleMediaType(mediaList: MediaExtended[]): boolean {
  const types = new Set(mediaList.map((media) => (media.type ? media.type : "unknown")));
  return types.size <= 1;
}

function getQuotedTweet(tweet: JsonObject, legacy: JsonObject): JsonObject | null {
  const candidates = [
    tweet.quoted_status_result,
    legacy.quoted_status_result,
    tweet.quoted_status,
    legacy.quoted_status,
    tweet.quoted_tweet,
    legacy.quoted_tweet,
  ];

  for (const candidate of candidates) {
    const quotedTweet = unwrapQuotedTweet(candidate);
    if (quotedTweet) {
      return quotedTweet;
    }
  }

  return null;
}

function unwrapQuotedTweet(value: unknown): JsonObject | null {
  if (!isJsonObject(value)) {
    return null;
  }

  if (value.__typename === "TweetUnavailable") {
    return null;
  }

  const result = value.result;
  if (isJsonObject(result)) {
    const tweet = unwrapQuotedTweet(result);
    if (tweet) {
      return tweet;
    }
  }

  const tweet = value.tweet;
  if (isJsonObject(tweet)) {
    const unwrappedTweet = unwrapQuotedTweet(tweet);
    return unwrappedTweet ?? tweet;
  }

  if (value.__typename === "Tweet" || isJsonObject(value.legacy) || value.rest_id || value.id_str) {
    return value;
  }

  return null;
}

function getQrtUrl(
  legacy: JsonObject,
  tweet: JsonObject,
  quotedTweet: JsonObject | null,
): string | null {
  const quotedStatusId =
    getString(legacy.quoted_status_id_str) ??
    getString(tweet.quoted_status_id_str) ??
    getString(getLegacyTweet(quotedTweet ?? {}).id_str) ??
    getString(quotedTweet?.rest_id) ??
    getString(quotedTweet?.id_str) ??
    getString(quotedTweet?.id);

  if (quotedStatusId) {
    return `https://twitter.com/i/status/${quotedStatusId}`;
  }

  const permalink = legacy.quoted_status_permalink;
  if (isJsonObject(permalink)) {
    const expanded = getString(permalink.expanded);
    if (expanded) {
      return expanded;
    }
  }

  const tweetPermalink = tweet.quoted_status_permalink;
  if (isJsonObject(tweetPermalink)) {
    return getString(tweetPermalink.expanded);
  }

  return null;
}

function buildTweetUrl(screenName: string, tweetId: string): string {
  return `https://twitter.com/${screenName}/status/${tweetId}`;
}

function toEpochSeconds(dateString: string): number | null {
  const timestamp = Date.parse(dateString);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.floor(timestamp / 1000);
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
  }

  return null;
}

function getBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

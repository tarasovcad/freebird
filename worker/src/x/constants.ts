export const TWITTER_HOST = "x.com";

export const REQUEST_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/**
 * Bearer token for the guest/activate.json endpoint.
 * It is NOT user-specific — it authenticates the app, not the user.
 * This is Twitter's hardcoded public bearer, embedded in their web client JS bundle.
 *
 * If this token becomes outdated (activate.json returns 401 / "Could not authenticate you"):
 *   1. Open twitter.com in a private/incognito window (no account logged in)
 *   2. Navigate to any post
 *   3. DevTools → Network → filter for "TweetResultByRestId"
 *   4. Open the request → Headers → copy the Authorization header value
 *
 *   Or extract from the JS bundle:
 *   1. DevTools → Sources → Ctrl+Shift+F → search "guest/activate"
 *   2. The bearer is hardcoded next to the endpoint string in main.*.js
 */

// ❌ revoked — copied from open-source scraping projects, no longer works
// "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I%2BAUYnrjZI%2B%2BzAoBqorAFUsSiHoRiX8Nkiyh3Z1WqHG1dv2g%2F5"

export const GUEST_ACTIVATE_BEARER =
  "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

export const TWEET_RESULT_BY_REST_ID_QUERY_ID = "0aTrQMKgj95K791yXeNDRA";

export const TWEET_RESULTS_BY_IDS_QUERY_ID = "2OOZWmw8nAtUHVnXXQhgaA";

export const TWEET_DETAIL_QUERY_ID = "Kzfv17rukSzjT96BerOWZA";

export const TWEET_DETAIL_FEATURES = {
  rweb_video_screen_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  rweb_tipjar_consumption_enabled: false,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: false,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  post_ctas_fetch_enabled: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,
  responsive_web_enhance_cards_enabled: false,
} as const;

export const TWEET_RESULT_BY_REST_ID_FEATURES = {
  // --- Grok (AI features) ---
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_grok_share_attachment_enabled: true,
  responsive_web_grok_annotations_enabled: false,
  responsive_web_grok_show_grok_translated_post: true,
  responsive_web_grok_analysis_button_from_backend: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_grok_imagine_annotation_enabled: true,
  responsive_web_grok_community_note_auto_translation_is_enabled: false,

  // --- Articles & longform ---
  articles_preview_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  longform_notetweets_consumption_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_jetfuel_frame: true,

  // --- Core tweet fields ---
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  post_ctas_fetch_enabled: true,

  // --- Communities ---
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,

  // --- User / profile ---
  profile_label_improvements_pcf_label_in_post_enabled: true,
  responsive_web_profile_redirect_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  verified_phone_label_enabled: false,

  // --- Monetization / subscriptions ---
  creator_subscriptions_tweet_preview_api_enabled: true,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  premium_content_api_read_enabled: false,
  rweb_tipjar_consumption_enabled: false,
  tweet_awards_web_tipping_enabled: false,

  // --- Misc / unclassified ---
  responsive_web_enhance_cards_enabled: false,
} as const;

export const TWEET_RESULTS_BY_IDS_FEATURES = {
  longform_notetweets_inline_media_enabled: true,
  super_follow_badge_privacy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  super_follow_user_api_enabled: true,
  super_follow_tweet_api_enabled: true,
  android_graphql_skip_api_media_color_palette: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  creator_subscriptions_subscription_count_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  longform_notetweets_consumption_enabled: true,
  subscriptions_verification_info_enabled: true,
  blue_business_profile_image_shape_enabled: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  super_follow_exclusive_tweet_notifications_enabled: true,
} as const;

export const TWEET_RESULT_BY_REST_ID_FIELD_TOGGLES = {
  withArticleRichContentState: true,
  withArticlePlainText: false,
  withArticleSummaryText: true,
  withArticleVoiceOver: true,
  withGrokAnalyze: false,
  withDisallowedReplyControls: false,
} as const;

export const ANDROID_TWITTER_BEARER =
  "Bearer AAAAAAAAAAAAAAAAAAAAAFXzAwAAAAAAMHCxpeSDG1gLNLghVe8d74hl6k4%3DRUMF4xAQLsbeBhTSRrCiQpJtxoGWeyHrDb5te2jpGskWDFW82F";

export const ANDROID_REQUEST_USER_AGENT =
  "TwitterAndroid/11.61.0-release.0 (311610000-r-0) G011A/9 (google;G011A;google;G011A;0;;1;2016)";

export const ANDROID_CONVERSATION_TIMELINE_V2_QUERY_ID = "Wrspae-uyGj-nWPyUqdUag";

export const ANDROID_CONVERSATION_TIMELINE_V2_FEATURES = {
  grok_translations_community_note_translation_is_enabled: false,
  super_follow_badge_privacy_enabled: true,
  unified_cards_destination_url_params_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  super_follow_user_api_enabled: true,
  profile_label_improvements_pcf_label_in_profile_enabled: true,
  premium_content_api_read_enabled: false,
  grok_translations_community_note_auto_translation_is_enabled: false,
  android_graphql_skip_api_media_color_palette: true,
  tweetypie_unmention_optimization_enabled: true,
  longform_notetweets_consumption_enabled: true,
  subscriptions_verification_info_enabled: true,
  blue_business_profile_image_shape_enabled: true,
  super_follow_exclusive_tweet_notifications_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  grok_android_analyze_trend_fetch_enabled: false,
  unified_cards_ad_metadata_container_dynamic_card_content_query_enabled: true,
  super_follow_tweet_api_enabled: true,
  articles_api_enabled: true,
  android_ad_formats_media_component_render_overlay_enabled: true,
  creator_subscriptions_tweet_preview_api_enabled: true,
  freedom_of_speech_not_reach_fetch_enabled: true,
  grok_translations_timeline_user_bio_auto_translation_is_enabled: false,
  grok_translations_post_auto_translation_is_enabled: false,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  immersive_video_status_linkable_timestamps: true,
  profile_label_improvements_pcf_label_in_post_enabled: true,
} as const;

export const SYNDICATION_URL = "https://cdn.syndication.twimg.com/tweet-result";

import {isJsonObject} from "./guards";
import type {JsonObject} from "./types";

const OPENAI_TRANSLATION_MODEL = "gpt-5-nano";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_TRANSLATION_TIMEOUT_MS = 150000;

type TranslateWithOpenAiOptions = {
  apiKey?: string;
  targetLanguage: string;
  tweet: JsonObject;
};

export async function translateWithOpenAi({
  apiKey,
  targetLanguage,
  tweet,
}: TranslateWithOpenAiOptions): Promise<JsonObject | null> {
  if (!apiKey) {
    console.log("OpenAI translation fallback skipped: OPENAI_API_KEY is not configured");
    return null;
  }

  const text = getTweetText(tweet);
  if (!text) {
    console.log("OpenAI translation fallback skipped: tweet has no text");
    return null;
  }

  const sourceLanguage = getTweetLanguage(tweet);
  if (sourceLanguage && sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) {
    console.log("OpenAI translation fallback skipped: source language matches target language");
    return null;
  }

  const translation = await requestOpenAiTranslation({
    apiKey,
    sourceLanguage,
    targetLanguage,
    text,
  });

  if (!translation) {
    return null;
  }

  return {
    ...tweet,
    grok_translated_post_with_availability: {
      is_available: true,
      data: {
        provider: "openai",
        source_language: sourceLanguage ?? null,
        destination_language: targetLanguage,
        entities: {
          hashtags: [],
          symbols: [],
          urls: [],
          user_mentions: [],
        },
        preview_translation: getPreviewTranslation(translation),
        translation,
      },
    },
  };
}

function getPreviewTranslation(translation: string): string {
  const preview = translation.slice(0, 280);
  return preview.length < translation.length ? preview.trimEnd() : preview;
}

async function requestOpenAiTranslation({
  apiKey,
  sourceLanguage,
  targetLanguage,
  text,
}: {
  apiKey: string;
  sourceLanguage: string | null;
  targetLanguage: string;
  text: string;
}): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENAI_TRANSLATION_TIMEOUT_MS);

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_TRANSLATION_MODEL,
        instructions:
          "Translate X/Twitter post text. Preserve @mentions, #hashtags, $cashtags, URLs, emojis, and line breaks. Return only the translation.",
        input: `Source language: ${sourceLanguage ?? "auto"}\nTarget language: ${targetLanguage}\n\n${text}`,
        store: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.log(
        `OpenAI translation fallback failed (${response.status}): ${await response.text()}`,
      );
      return null;
    }

    const body: unknown = await response.json();
    if (!isJsonObject(body)) {
      console.log("OpenAI translation fallback returned unexpected response");
      return null;
    }

    const translation = getOpenAiResponseText(body)?.trim();
    return translation || null;
  } catch (error) {
    console.log(`OpenAI translation fallback failed: ${getErrorMessage(error)}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getOpenAiResponseText(response: JsonObject): string | null {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  const output = response.output;
  if (!Array.isArray(output)) {
    return null;
  }

  const textParts: string[] = [];
  for (const item of output) {
    if (!isJsonObject(item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (isJsonObject(content) && typeof content.text === "string") {
        textParts.push(content.text);
      }
    }
  }

  return textParts.length > 0 ? textParts.join("") : null;
}

function getTweetText(tweet: JsonObject): string | null {
  const legacy = tweet.legacy;
  if (!isJsonObject(legacy)) {
    return null;
  }

  const noteTweetText = getNoteTweetText(tweet);
  const text =
    noteTweetText ??
    getString(legacy.full_text) ??
    getString(legacy.text) ??
    getString(tweet.full_text) ??
    getString(tweet.text);

  return text?.trimEnd() || null;
}

function getNoteTweetText(tweet: JsonObject): string | null {
  const noteTweet = tweet.note_tweet;
  if (!isJsonObject(noteTweet)) {
    return null;
  }

  const noteTweetResults = noteTweet.note_tweet_results;
  if (!isJsonObject(noteTweetResults)) {
    return null;
  }

  const result = noteTweetResults.result;
  if (!isJsonObject(result)) {
    return null;
  }

  return getString(result.text);
}

function getTweetLanguage(tweet: JsonObject): string | null {
  const legacy = tweet.legacy;
  if (!isJsonObject(legacy)) {
    return null;
  }

  return getString(legacy.lang);
}

function getString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

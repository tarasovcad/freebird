<img src="./public/logo.svg" alt="Freebird logo" width="72" />

# Freebird

A tool for fetching full X post data by reusing the bearer tokens embedded in Twitter's own web, mobile, and Android clients.

The long-term goal is to make Freebird a flexible fetcher that can normalize content from platforms like Reddit, Dribbble, and Layers into a consistent structure

## What it does

- Fetch post and page metadata
- Extract media, links, mentions, author info, and thread context
- Resolve quoted posts and nested content where supported
- Normalize data across different platforms
- Return structured JSON output
- Stay lightweight and fast

## Roadmap / TODO

- [ ] Create a web page for blogs
- [ ] Add self hosting support
- [ ] Add source adapters for Reddit
- [ ] Add source adapters for Dribbble
- [ ] Add source adapters for Layers
- [ ] Document token requirements per method and per source
- [ ] Add examples for each supported platform
- [ ] Add tests and fixtures for platform-specific responses
- [ ] Expand the public API docs
- [ ] Improve OpenAI translation latency

## API routes

The worker exposes `GET` routes for fetching status data.

| Route                                        | Description                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `/status`                                    | Base route. Expects `url` as a query parameter or path parameter.              |
| `/status/:url`                               | Fetch a status using the provided URL. The URL path segment should be encoded. |
| `/status/:url/format/:format`                | Fetch a status and force a response format.                                    |
| `/status/:url/lang/:lang`                    | Fetch a status translated to the requested language.                           |
| `/status/:url/format/:format/lang/:lang`     | Fetch a translated status and force a response format.                         |
| `/status/:url/lang/:lang/format/:format`     | Same as above, with the path segment order reversed.                           |
| `/status/:url/method/:method`                | Fetch a status with a specific extraction method.                              |
| `/status/:url/method/:method/format/:format` | Fetch a status with both a specific method and format.                         |
| `/status/:url/format/:format/method/:method` | Same as above, with the path segment order reversed.                           |

### Parameters

| Parameter | Where it can appear          | Description                                                                                          |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `url`     | Path segment or query string | The X/Twitter URL or identifier to fetch. If used in the path, it must be URL-encoded.               |
| `method`  | Path segment or query string | Selects the extraction strategy. If omitted, Freebird automatically tries the best available method. |
| `format`  | Path segment or query string | Controls the response shape.                                                                         |
| `lang`    | Path segment                 | Requests a translated status using a BCP 47-style language code such as `en`, `uk`, or `pt-br`.      |

### Supported `method` values

| Method         | What it does                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `rest-guest`   | Uses the guest REST flow.                                                                                                |
| `rest-auth`    | Uses the authenticated REST flow and requires configured auth tokens.                                                    |
| `v2`           | Uses the v2 fetch flow with available auth tokens.                                                                       |
| `android`      | Uses Android client-style extraction.                                                                                    |
| `tweet-detail` | Uses tweet detail extraction. `simple`/`simplified` returns parsed detail data; `full`/`raw` keeps the raw detail shape. |
| `syndication`  | Uses the syndication-based fetch flow.                                                                                   |

### Supported `format` values

| Format value | Result                                                               |
| ------------ | -------------------------------------------------------------------- |
| `full`       | Returns the full structured response. `raw` is accepted as an alias. |
| `simple`     | Returns a simplified response. `simplified` is accepted as an alias. |

### Translation

Freebird supports translated status responses with the `lang` path parameter:

```text
GET /status/:url/lang/:lang
GET /status/:url/format/:format/lang/:lang
GET /status/:url/lang/:lang/format/:format
```

Translation runs only when `lang` is present and no explicit `method` is selected. Freebird currently tries three translation methods in order:

| Order | Method          | What it does                                                                                 |
| ----- | --------------- | -------------------------------------------------------------------------------------------- |
| 1     | `rest-auth`     | Tries X/Grok translation through the authenticated REST flow. Requires configured X tokens.  |
| 2     | `tweet-detail`  | Tries X/Grok translation through Tweet Detail. Requires configured X tokens.                 |
| 3     | OpenAI fallback | Fetches the source tweet and translates it with OpenAI when X/Grok does not return a result. |

The OpenAI fallback requires `OPENAI_API_KEY` to be configured. In simplified responses, OpenAI fallback translations include `provider: "openai"` inside the `translation` object.

### Request examples

```text
GET /status/783450192846517203
GET /status/783450192846517203/format/simple
GET /status/783450192846517203/lang/uk
GET /status/783450192846517203/format/simple/lang/uk
GET /status/783450192846517203/method/rest-guest
GET /status?url=783450192846517203&format=full&method=v2
```

## Worker packages

| Package                                                                    | Role                                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`hono`](https://hono.dev)                                                 | Web framework — handles routing and request/response on Cloudflare Workers |
| [`wrangler`](https://developers.cloudflare.com/workers/wrangler/)          | Cloudflare CLI — local dev server and deployment                           |
| [`@cloudflare/workers-types`](https://github.com/cloudflare/workers-types) | TypeScript types for the Cloudflare Workers runtime APIs                   |
| `typescript`                                                               | Type-checks the codebase; no runtime output                                |

## Folder structure

```text
freebird/
├── worker/
│   └── src/
│       ├── index.ts
│       └── x/
│           ├── auth.ts                        # Builds auth headers and guest token logic
│           ├── constants.ts
│           ├── errors.ts
│           ├── extract-status.ts              # Main status extraction flow and fallback order
│           ├── fix-tweet-data.ts              # Normalizes tweet payloads before returning them
│           ├── guards.ts
│           ├── simplify-status-response.ts    # Converts full responses into simplified output
│           ├── simplify-tweet.ts              # Simplifies a tweet object for consumers
│           ├── status-method.ts
│           ├── token-attempts.ts
│           ├── tweet-conversation-timeline-v2-android.ts # Android-style conversation fetcher
│           ├── tweet-detail.ts                # Tweet detail fetcher and reply chain handling
│           ├── tweet-result-by-rest-id.ts     # REST fetch by tweet ID
│           ├── tweet-results-by-ids.ts        # v2 fetch by tweet IDs
│           ├── tweet-syndication.ts           # Syndication-based fetcher
│           ├── tweet-url.ts
│           ├── types.ts
│           └── workaround-tokens.ts
```

## Sources / Helpful links

- https://scrapfly.io/blog/posts/how-to-scrape-twitter
- https://data365.co/blog/twitter-graphql-api
- https://github.com/fa0311/TwitterInternalAPIDocument/blob/master/docs/markdown/GraphQL.md
- https://antibot.blog/posts/1741552025433
- https://github.com/daisyUniverse/TwitFix
- https://github.com/dylanpdx/BetterTwitFix
- https://fa0311.github.io/twitter-openapi-docs/
- https://github.com/BANKA2017/twitter-monitor-assets/blob/master/graphql/graphqlQueryIdList.json#L5513
- https://github.com/fa0311/TwitterInternalAPIDocument/blob/master/docs/json/API.json

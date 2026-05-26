# Freebird

A tool for fetching full X post data by reusing the bearer tokens embedded in Twitter's own web, mobile, and Android clients.

Features:

- Fetch post metadata
- Extract media, links, mentions, and author info
- Resolve threads and quoted posts
- Structured JSON output
- Lightweight and fast

## Worker packages

| Package                                                                    | Role                                                                       |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`hono`](https://hono.dev)                                                 | Web framework — handles routing and request/response on Cloudflare Workers |
| [`wrangler`](https://developers.cloudflare.com/workers/wrangler/)          | Cloudflare CLI — local dev server and deployment                           |
| [`@cloudflare/workers-types`](https://github.com/cloudflare/workers-types) | TypeScript types for the Cloudflare Workers runtime APIs                   |
| `typescript`                                                               | Type-checks the codebase; no runtime output                                |

## Folder structure

```
freebird/
├── web/                    # Next.js landing (Vercel)
├── worker/                 # Hono CF Worker
├── vercel/                 # Next.js API-only
│   └── app/
│       └── api/
│           └── status/
│               └── [id]/
│                   └── route.ts
└── packages/
    └── core/               # shared fetcher logic
        ├── fetcher.ts      # Twitter fetch logic
        └── package.json
```

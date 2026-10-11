# vid-gen-ta

A small Next.js app that turns a text prompt into a short video. It uses
[Replicate](https://replicate.com)'s `minimax/video-01` model to generate the clip, then stores
the last 20 results (thumbnail + prompt) in the browser so you can replay them from a carousel
while the next one renders.

## Features

- Prompt input with a "Generate short video" button.
- Server-side API routes that call Replicate (your API token never reaches the browser).
- Client-side polling of generation status with a timeout and error handling.
- In-page `<video>` player for the result.
- A recent-videos carousel (up to 3 thumbnails at a time, paged with `‹` / `›`) below the
  input. Thumbnails are captured from the video client-side; clicking one plays it.
- History of the 20 most recent generations, persisted in `localStorage`.

## Prerequisites

- Node.js 20.9+ (Next.js 16 requires a modern Node runtime).
- A Replicate account and API token: <https://replicate.com/account/api-tokens>.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local env file and add your token:

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local`:

   ```
   REPLICATE_API_TOKEN=your_token_here
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open <http://localhost:3000>, enter a prompt, and generate a video.

## Scripts

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `npm run dev`   | Start the dev server (Turbopack).  |
| `npm run build` | Production build.                  |
| `npm start`     | Run the production build.          |
| `npm run lint`  | Lint with ESLint.                  |

## How it works

- `app/page.tsx` — client UI: prompt form, status, video player, and the history carousel.
- `app/api/predictions/route.ts` — starts a Replicate prediction.
- `app/api/predictions/[id]/route.ts` — returns the status/output for polling.
- `lib/replicate.ts` — server-only Replicate API wrapper.
- `lib/history.ts` — `localStorage`-backed history store and client-side thumbnail capture.

See [NOTES.md](./NOTES.md) for a detailed description of the changes.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [React 19](https://react.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Replicate](https://replicate.com) (`minimax/video-01`)

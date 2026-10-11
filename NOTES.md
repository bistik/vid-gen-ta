# Notes

Record of the changes added to the `vid-gen-ta` project.

## 1. Video generation (Replicate + minimax/video-01)

Prompt-to-video generation using Replicate's `minimax/video-01` model.

### `lib/replicate.ts` (new)
Server-only helper around the Replicate REST API.

- `createVideoPrediction(prompt)` — `POST /v1/models/minimax/video-01/predictions` with
  `{ input: { prompt, prompt_optimizer: true } }`.
- `getVideoPrediction(id)` — `GET /v1/predictions/{id}` used for polling.
- Reads `REPLICATE_API_TOKEN` from the environment and throws a clear error if it is missing.
- Returns a narrowed `Prediction` type (`id`, `status`, `output`, `error`); `output` is a
  video URL string or an array of URLs.

### `app/api/predictions/route.ts` (new)
- `POST` starts a prediction. Validates that `prompt` is a non-empty string (400 otherwise),
  returns the prediction as `201`, and maps upstream failures to `502`.

### `app/api/predictions/[id]/route.ts` (new)
- `GET` proxies the prediction status for client-side polling.

### `app/page.tsx` (new)
- Client component with a prompt input and a "Generate short video" button.
- On submit, starts a prediction, then polls `/api/predictions/{id}` every 2s (max 150 polls
  / ~5 min timeout).
- Renders the result in a `<video>` player (autoplay, loop, controls).
- Tracks `phase` (`idle` | `generating` | `done` | `error`) and shows generation/error status.

## 2. Recent-videos carousel

Browsable history of generated videos so there is something to do while waiting for a new one.

### Key fact: Replicate does not return a thumbnail
For `minimax/video-01` the prediction `output` is only the video URL — there is no thumbnail
field. Thumbnails are therefore generated **client-side**: a frame is drawn to a canvas and
exported as a small JPEG. This works because output files are served from `replicate.delivery`
with `access-control-allow-origin: *`, so the canvas is not tainted. If the frame cannot be
grabbed (CORS, timeout, blocked frame), a drawn gradient placeholder with a play glyph is used
instead so the carousel always has something to show.

### `lib/history.ts` (new)
- `VideoHistoryItem` = `{ id, videoUrl, thumbnail, prompt, createdAt }`.
- History capped at `MAX_HISTORY = 20` items, persisted to `localStorage` under
  `vid-gen-ta:history:v1`.
- Exposed through an external store (`subscribeHistory` / `getHistorySnapshot` /
  `getHistoryServerSnapshot`) consumed with React's `useSyncExternalStore`. This keeps reads
  hydration-safe (server snapshot is empty) and satisfies the Next 16
  `react-hooks/set-state-in-effect` rule, which rejects synchronous `setState` in an effect.
- `addHistoryItem` prepends new items and de-dupes by prediction id.
- `persist` shrinks the list on `QuotaExceededError` instead of throwing.
- Cross-tab sync via the window `storage` event.
- `promptPreview` trims a prompt to its first 10 words for display/storage.
- `captureThumbnail(videoUrl, label)` loads the video offscreen with `crossOrigin="anonymous"`,
  draws a frame to a 320px-wide JPEG at quality 0.6, and falls back to `drawPlaceholder`.

### `app/page.tsx` (updated)
- Saves each successful generation to history with its thumbnail.
- Carousel below the input/button: `‹` and `›` buttons flanking a centered window of up to
  **3 thumbnails**; each shows a one-line prompt caption and highlights when active.
- Arrows step one item at a time and disable at the ends. The carousel is hidden when history
  is empty.
- Clicking a thumbnail plays it in the player and smooth-scrolls it into view.
- The player is no longer cleared on submit, so you can keep browsing/watching while a new
  video generates.

## Storage notes / limitations
- 20 thumbnails at ~20–40 KB each stays well under the ~5 MB `localStorage` budget.
- Old `replicate.delivery` URLs can expire, so very old carousel items may eventually fail to
  play.

## Validation
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` all pass.

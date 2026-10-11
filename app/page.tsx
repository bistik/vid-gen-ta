"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  addHistoryItem,
  captureThumbnail,
  getHistoryServerSnapshot,
  getHistorySnapshot,
  promptPreview,
  subscribeHistory,
  type VideoHistoryItem,
} from "@/lib/history";

type Phase = "idle" | "generating" | "done" | "error";

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 150;
const CAROUSEL_SIZE = 3;

function firstOutputUrl(output: string | string[] | null): string | null {
  if (Array.isArray(output)) {
    return output[0] ?? null;
  }
  return output;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [windowStart, setWindowStart] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);

  const history = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistoryServerSnapshot,
  );

  const pendingPrompt = useRef("");
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!predictionId) return;

    let cancelled = false;
    let polls = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const response = await fetch(`/api/predictions/${predictionId}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          status?: string;
          output?: string | string[] | null;
          error?: string | null;
        };

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(data.error ?? "Failed to check generation status.");
        }

        if (data.status === "succeeded") {
          const url = firstOutputUrl(data.output ?? null);
          if (!url) {
            throw new Error("The model finished without returning a video.");
          }
          setVideoUrl(url);
          setPhase("done");
          setActiveId(predictionId);

          void (async () => {
            const thumbnail = await captureThumbnail(url, pendingPrompt.current);
            if (cancelled) return;

            addHistoryItem({
              id: predictionId,
              videoUrl: url,
              thumbnail,
              prompt: promptPreview(pendingPrompt.current),
              createdAt: Date.now(),
            });
            setWindowStart(0);
          })();

          return;
        }

        if (data.status === "failed" || data.status === "canceled") {
          throw new Error(data.error ?? "Video generation failed.");
        }

        polls += 1;
        if (polls >= MAX_POLLS) {
          throw new Error("Timed out waiting for the video.");
        }

        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("error");
      }
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [predictionId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = prompt.trim();
    if (!trimmed || phase === "generating") return;

    pendingPrompt.current = trimmed;
    setPhase("generating");
    setPredictionId(null);
    setError(null);

    try {
      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = (await response.json()) as { id?: string; error?: string };

      if (!response.ok || !data.id) {
        throw new Error(data.error ?? "Failed to start generation.");
      }

      setPredictionId(data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("error");
    }
  }

  function playFromHistory(item: VideoHistoryItem) {
    setVideoUrl(item.videoUrl);
    setActiveId(item.id);
    setError(null);
    setPhase((current) => (current === "generating" ? current : "done"));
    playerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function shiftWindow(delta: number) {
    const maxStart = Math.max(0, history.length - CAROUSEL_SIZE);
    setWindowStart((start) =>
      Math.min(Math.max(start + delta, 0), maxStart),
    );
  }

  const isGenerating = phase === "generating";
  const maxStart = Math.max(0, history.length - CAROUSEL_SIZE);
  const start = Math.min(windowStart, maxStart);
  const visible = history.slice(start, start + CAROUSEL_SIZE);
  const canGoPrev = start > 0;
  const canGoNext = start + CAROUSEL_SIZE < history.length;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="flex w-full max-w-xl flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Generate a short video
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Describe a scene and we&apos;ll turn it into a short clip.
        </p>
        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Enter a prompt for a short video..."
            className="h-12 w-full flex-1 rounded-full border border-black/[.08] bg-white px-5 text-base outline-none transition-colors placeholder:text-zinc-400 focus:border-black/20 dark:border-white/[.145] dark:bg-zinc-900 dark:focus:border-white/30"
          />
          <button
            type="submit"
            disabled={isGenerating || prompt.trim().length === 0}
            className="h-12 shrink-0 rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {isGenerating ? "Generating..." : "Generate short video"}
          </button>
        </form>
        {isGenerating && (
          <p className="text-sm text-zinc-500">
            This can take a minute. Hang tight...
          </p>
        )}
        {phase === "error" && error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {history.length > 0 && (
          <div className="flex w-full items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => shiftWindow(-1)}
              disabled={!canGoPrev}
              aria-label="Previous videos"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[.08] text-lg text-zinc-600 transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-white/[.06]"
            >
              ‹
            </button>
            <div className="flex flex-1 items-start justify-center gap-3">
              {visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => playFromHistory(item)}
                  title={item.prompt}
                  className="group flex w-28 shrink-0 flex-col gap-1.5 text-left"
                >
                  <span
                    className={`relative block aspect-video w-full overflow-hidden rounded-xl border transition-transform group-hover:-translate-y-0.5 ${
                      activeId === item.id
                        ? "border-foreground ring-2 ring-foreground/40"
                        : "border-black/[.08] dark:border-white/[.145]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbnail}
                      alt={item.prompt}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/25 group-hover:opacity-100">
                      ▶
                    </span>
                  </span>
                  <span className="line-clamp-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {item.prompt}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => shiftWindow(1)}
              disabled={!canGoNext}
              aria-label="Next videos"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[.08] text-lg text-zinc-600 transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/[.145] dark:text-zinc-300 dark:hover:bg-white/[.06]"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {videoUrl && (
        <div ref={playerRef} className="w-full max-w-2xl">
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full rounded-2xl border border-black/[.08] dark:border-white/[.145]"
          />
        </div>
      )}
    </main>
  );
}

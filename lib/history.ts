export type VideoHistoryItem = {
  id: string;
  videoUrl: string;
  thumbnail: string;
  prompt: string;
  createdAt: number;
};

export const MAX_HISTORY = 20;

const STORAGE_KEY = "vid-gen-ta:history:v1";
const THUMB_WIDTH = 320;
const THUMB_QUALITY = 0.6;
const FRAME_TIMEOUT_MS = 15000;

const EMPTY: VideoHistoryItem[] = [];

export function promptPreview(prompt: string, words = 10): string {
  return prompt.trim().split(/\s+/).slice(0, words).join(" ");
}

function isHistoryItem(value: unknown): value is VideoHistoryItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.videoUrl === "string" &&
    typeof item.thumbnail === "string" &&
    typeof item.prompt === "string" &&
    typeof item.createdAt === "number"
  );
}

function read(): VideoHistoryItem[] {
  if (typeof window === "undefined") return EMPTY;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const items = parsed.filter(isHistoryItem).slice(0, MAX_HISTORY);
    return items.length > 0 ? items : EMPTY;
  } catch {
    return EMPTY;
  }
}

function persist(items: VideoHistoryItem[]): VideoHistoryItem[] {
  if (typeof window === "undefined") return items;

  let next = items;
  while (next.length > 0) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    } catch {
      next = next.slice(0, next.length - 1);
    }
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors; nothing more we can do.
  }
  return [];
}

let cache: VideoHistoryItem[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getHistorySnapshot(): VideoHistoryItem[] {
  if (cache === null) cache = read();
  return cache;
}

export function getHistoryServerSnapshot(): VideoHistoryItem[] {
  return EMPTY;
}

export function subscribeHistory(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      cache = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function addHistoryItem(item: VideoHistoryItem): void {
  const next = persist(
    [item, ...getHistorySnapshot().filter((entry) => entry.id !== item.id)].slice(
      0,
      MAX_HISTORY,
    ),
  );
  cache = next;
  emit();
}

function thumbnailHeight(video: HTMLVideoElement): number {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Math.round((video.videoHeight / video.videoWidth) * THUMB_WIDTH);
  }
  return Math.round((THUMB_WIDTH * 9) / 16);
}

function loadFirstFrame(videoUrl: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const cleanup = () => {
      clearTimeout(timer);
      video.onloadeddata = null;
      video.onerror = null;
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out loading a video frame."));
    }, FRAME_TIMEOUT_MS);

    video.onloadeddata = () => {
      cleanup();
      resolve(video);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Could not load the video for a thumbnail."));
    };

    video.src = videoUrl;
  });
}

function drawPlaceholder(label: string): string {
  const width = THUMB_WIDTH;
  const height = Math.round((width * 9) / 16);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = (hash * 31 + label.charCodeAt(i)) % 360;
  }

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, `hsl(${hash} 70% 45%)`);
  gradient.addColorStop(1, `hsl(${(hash + 40) % 360} 70% 25%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("▶", width / 2, height / 2);

  return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
}

export async function captureThumbnail(
  videoUrl: string,
  label: string,
): Promise<string> {
  if (typeof document === "undefined") return "";

  try {
    const video = await loadFirstFrame(videoUrl);
    const width = THUMB_WIDTH;
    const height = thumbnailHeight(video);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported.");

    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", THUMB_QUALITY);
  } catch {
    return drawPlaceholder(label);
  }
}

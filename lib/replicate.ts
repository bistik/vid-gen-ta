const REPLICATE_API = "https://api.replicate.com/v1";

const VIDEO_MODEL = "minimax/video-01";

export type PredictionStatus =
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

export type Prediction = {
  id: string;
  status: PredictionStatus;
  output: string | string[] | null;
  error: string | null;
};

function getToken(): string {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error(
      "REPLICATE_API_TOKEN is not set. Add it to .env.local to generate videos.",
    );
  }
  return token;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string };
    return data.detail ?? `Replicate request failed (${response.status})`;
  } catch {
    return `Replicate request failed (${response.status})`;
  }
}

function toPrediction(prediction: Prediction): Prediction {
  return {
    id: prediction.id,
    status: prediction.status,
    output: prediction.output,
    error: prediction.error,
  };
}

export async function createVideoPrediction(
  prompt: string,
): Promise<Prediction> {
  const response = await fetch(
    `${REPLICATE_API}/models/${VIDEO_MODEL}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          prompt,
          prompt_optimizer: true,
        },
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return toPrediction((await response.json()) as Prediction);
}

export async function getVideoPrediction(id: string): Promise<Prediction> {
  const response = await fetch(`${REPLICATE_API}/predictions/${id}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return toPrediction((await response.json()) as Prediction);
}

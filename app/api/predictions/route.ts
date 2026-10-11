import { createVideoPrediction } from "@/lib/replicate";

export async function POST(request: Request) {
  let prompt = "";

  try {
    const body = (await request.json()) as { prompt?: unknown };
    if (typeof body.prompt === "string") {
      prompt = body.prompt.trim();
    }
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!prompt) {
    return Response.json({ error: "A prompt is required." }, { status: 400 });
  }

  try {
    const prediction = await createVideoPrediction(prompt);
    return Response.json(prediction, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start generation.";
    return Response.json({ error: message }, { status: 502 });
  }
}

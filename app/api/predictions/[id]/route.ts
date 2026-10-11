import { getVideoPrediction } from "@/lib/replicate";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const prediction = await getVideoPrediction(id);
    return Response.json(prediction);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch prediction.";
    return Response.json({ error: message }, { status: 502 });
  }
}

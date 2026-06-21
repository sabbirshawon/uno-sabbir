import { getUserFromRequest } from "@/lib/server/firebaseAdmin";
import { fail, ok } from "@/lib/server/responses";
import { joinRoom } from "@/lib/server/gameEngine";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const body = (await request.json()) as { code?: string; mode?: "player" | "spectator" };
    const result = await joinRoom(body.code || "", user, body.mode === "spectator" ? "spectator" : "player");
    return ok(result);
  } catch (error) {
    return fail(error, "Could not join room");
  }
}

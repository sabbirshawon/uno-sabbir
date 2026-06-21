import { getUserFromRequest } from "@/lib/server/firebaseAdmin";
import { fail, ok } from "@/lib/server/responses";
import { createRoom } from "@/lib/server/gameEngine";

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    const result = await createRoom(user);
    return ok(result, 201);
  } catch (error) {
    return fail(error, "Could not create room");
  }
}

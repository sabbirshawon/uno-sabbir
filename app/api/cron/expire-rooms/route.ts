import { expireOldRooms } from "@/lib/server/gameEngine";
import { fail, ok } from "@/lib/server/responses";

export async function GET(request: Request) {
  try {
    const secret = request.headers.get("x-cron-secret") || new URL(request.url).searchParams.get("secret");
    return ok(await expireOldRooms(secret));
  } catch (error) {
    return fail(error, "Could not expire rooms");
  }
}

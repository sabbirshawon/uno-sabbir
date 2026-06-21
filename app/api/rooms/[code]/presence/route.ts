import { getUserFromRequest } from "@/lib/server/firebaseAdmin";
import { updatePresence } from "@/lib/server/gameEngine";
import { fail, ok } from "@/lib/server/responses";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    const { code } = await params;
    const body = (await request.json()) as { online?: boolean };
    return ok(await updatePresence(code, user, body.online !== false));
  } catch (error) {
    return fail(error, "Could not update presence");
  }
}

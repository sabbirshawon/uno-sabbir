import { getUserFromRequest } from "@/lib/server/firebaseAdmin";
import { drawOneCard } from "@/lib/server/gameEngine";
import { fail, ok } from "@/lib/server/responses";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    const { code } = await params;
    return ok(await drawOneCard(code, user));
  } catch (error) {
    return fail(error, "Could not draw card");
  }
}

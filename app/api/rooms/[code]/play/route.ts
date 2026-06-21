import { getUserFromRequest } from "@/lib/server/firebaseAdmin";
import { playCard } from "@/lib/server/gameEngine";
import { fail, ok } from "@/lib/server/responses";
import type { PlayColor } from "@/lib/types";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    const { code } = await params;
    const body = (await request.json()) as { cardId?: string; chosenColor?: PlayColor };
    return ok(await playCard(code, user, body.cardId || "", body.chosenColor));
  } catch (error) {
    return fail(error, "Could not play card");
  }
}

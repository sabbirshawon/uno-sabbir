import { getUserFromRequest } from "@/lib/server/firebaseAdmin";
import { sendChatMessage } from "@/lib/server/gameEngine";
import { fail, ok } from "@/lib/server/responses";

type Params = { params: Promise<{ code: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const user = await getUserFromRequest(request);
    const { code } = await params;
    const body = (await request.json()) as { text?: string; type?: "text" | "emoji" };
    return ok(await sendChatMessage(code, user, body.text || "", body.type === "emoji" ? "emoji" : "text"));
  } catch (error) {
    return fail(error, "Could not send chat message");
  }
}

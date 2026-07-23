import { NextResponse, type NextRequest } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  validateScreenToken,
  getWaitingScreenByToken,
  getWaitingScreenBySession,
} from "@/lib/waiting-room";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const { ok } = rateLimit(`sala:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const token = request.nextUrl.searchParams.get("token") ?? "";

  if (token && (await validateScreenToken(token))) {
    const data = await getWaitingScreenByToken();
    return NextResponse.json(data ?? {}, { headers: { "Cache-Control": "no-store" } });
  }

  const user = await getActiveUser();
  if (user) {
    const data = await getWaitingScreenBySession();
    return NextResponse.json(data ?? {}, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

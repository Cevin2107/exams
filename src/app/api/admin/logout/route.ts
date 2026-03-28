import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.delete("admin_auth");
  // Redirect back to login page using the request origin
  const origin = req.headers.get("origin") || req.nextUrl.origin;
  return NextResponse.redirect(`${origin}/admin`, { status: 303 });
}

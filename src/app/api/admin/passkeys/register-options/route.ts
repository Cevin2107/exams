import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPasskeyRelyingParty, PASSKEY_CHALLENGE_COOKIE } from "@/lib/passkeys";
import { generateRegistrationOptions } from "@simplewebauthn/server";

export async function POST(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const supabase = createSupabaseAdmin();
    const { data: passkeys, error } = await (supabase
      .from("admin_passkeys") as any)
      .select("credential_id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { rpID, rpName } = getPasskeyRelyingParty(req);
    const options = await generateRegistrationOptions({
      rpID,
      rpName,
      userID: new TextEncoder().encode("admin"),
      userName: "admin",
      timeout: 60000,
      attestationType: "none",
      excludeCredentials: ((passkeys as any[]) || []).map((item: any) => ({
        id: item.credential_id,
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    });

    const response = NextResponse.json(options);
    response.cookies.set(PASSKEY_CHALLENGE_COOKIE.register, options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 5,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Passkey register options error:", error);
    const message = error instanceof Error ? error.message : "Không thể tạo yêu cầu đăng ký";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

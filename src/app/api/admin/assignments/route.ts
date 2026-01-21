import { NextRequest, NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/adminAuth";
import { createAssignment } from "@/lib/supabaseHelpers";

export async function POST(req: NextRequest) {
  const isAuth = await checkAdminAuth();
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    console.log("Creating assignment with data:", body);
    const assignment = await createAssignment(body);
    console.log("Assignment created successfully:", assignment);
    return NextResponse.json(assignment);
  } catch (error) {
    console.error("Error creating assignment:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create assignment";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

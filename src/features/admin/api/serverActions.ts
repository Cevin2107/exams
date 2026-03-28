"use server";

import { fetchAllAssignmentsAdmin } from "@/lib/supabaseHelpers";

export async function getAdminAssignmentsAction() {
  return fetchAllAssignmentsAdmin();
}

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminAssignmentsAction } from "../api/serverActions";

export function useAdminAssignments() {
  return useQuery({
    queryKey: ["admin-assignments"],
    queryFn: async () => getAdminAssignmentsAction(),
  });
}

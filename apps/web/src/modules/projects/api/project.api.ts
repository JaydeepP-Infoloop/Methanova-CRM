import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { createResourceApi } from "../../../lib/apiResource";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";
import type { ProjectAuditRow, ProjectRow } from "../types";

export const projectApi = createResourceApi<ProjectRow>("/api/projects", RESOURCE.projects);

export function useProjectList(mine: boolean) {
  return useQuery({
    queryKey: queryKeys.list(RESOURCE.projects, { mine }),
    queryFn: () => apiClient<ProjectRow[]>(`/api/projects${mine ? "?mine=true" : ""}`),
  });
}

export function useProject(id: string | undefined) {
  return projectApi.useItem(id);
}

export function useReplaceMembers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      apiClient<ProjectRow>(`/api/projects/${id}/members`, {
        method: "PUT",
        body: JSON.stringify({ userIds }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.projects) }),
  });
}

export function useProjectAudit(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sub(RESOURCE.projects, id, "audit"),
    enabled: Boolean(id),
    queryFn: () => apiClient<ProjectAuditRow[]>(`/api/projects/${id}/audit`),
  });
}

export function useUploadProjectLetterhead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, filename, dataBase64 }: { id: string; filename: string; dataBase64: string }) =>
      apiClient<ProjectRow>(`/api/projects/${id}/letterhead`, {
        method: "POST",
        body: JSON.stringify({ filename, dataBase64 }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.projects) }),
  });
}

export function useInheritProjectLetterhead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<ProjectRow>(`/api/projects/${id}/letterhead`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.projects) }),
  });
}

export function useResetProjectLetterhead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<ProjectRow>(`/api/projects/${id}/letterhead/reset`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.resource(RESOURCE.projects) }),
  });
}

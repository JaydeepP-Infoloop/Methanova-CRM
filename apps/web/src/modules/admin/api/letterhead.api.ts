import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiBinary, apiClient } from "../../../lib/apiClient";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";

export interface OrgLetterhead {
  fileId: string | null;
  legalName: string;
  file: { _id: string; mime: string; width: number; height: number } | null;
}

export function useOrgLetterhead() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masterData, "org-letterhead"),
    queryFn: () => apiClient<OrgLetterhead>("/api/files/org-letterhead"),
  });
}

export function usePatchOrgLetterhead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { legalName: string }) =>
      apiClient<OrgLetterhead>("/api/files/org-letterhead", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.op(RESOURCE.masterData, "org-letterhead") }),
  });
}

export function useUploadOrgLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { filename: string; dataBase64: string }) =>
      apiClient("/api/files", {
        method: "POST",
        body: JSON.stringify({ kind: "ORG_LOGO", ...payload }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.op(RESOURCE.masterData, "org-letterhead") }),
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function useFileObjectUrl(fileId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masterData, "file-content", fileId),
    enabled: Boolean(fileId),
    queryFn: async () => {
      const blob = await apiBinary(`/api/files/${fileId}/content`);
      return URL.createObjectURL(blob);
    },
    staleTime: 60_000,
  });
}

export interface NotificationDefaults {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  taskOverdueToAssignee: boolean;
  taskOverdueToProjectManager: boolean;
}

export function useNotificationDefaults() {
  return useQuery({
    queryKey: queryKeys.op(RESOURCE.masters, "notification-defaults"),
    queryFn: () => apiClient<NotificationDefaults>("/api/masters/notification-defaults"),
  });
}

export function useUpdateNotificationDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NotificationDefaults) =>
      apiClient<NotificationDefaults>("/api/masters/notification-defaults", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.op(RESOURCE.masters, "notification-defaults") }),
  });
}

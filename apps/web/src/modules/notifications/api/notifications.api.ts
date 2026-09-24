import type { NotificationListResponseDto } from "@methanova/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/apiClient";
import { queryKeys, RESOURCE } from "../../../lib/queryKeys";

const BASE = "/api/notifications";

export interface NotificationListFilters {
  page: number;
  pageSize: number;
  unreadOnly?: boolean;
}

function toQueryString(filters: NotificationListFilters): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));
  if (filters.unreadOnly) params.set("unreadOnly", "true");
  return params.toString();
}

export const notificationKeys = {
  all: queryKeys.resource(RESOURCE.notifications),
  list: (filters: NotificationListFilters) => queryKeys.list(RESOURCE.notifications, filters),
  unreadCount: () => queryKeys.op(RESOURCE.notifications, "unread-count"),
};

export function useNotificationList(filters: NotificationListFilters) {
  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () => apiClient<NotificationListResponseDto>(`${BASE}?${toQueryString(filters)}`),
  });
}

/**
 * Polling, not a WebSocket — no new dependency, and at ~25 users a 30s poll
 * is indistinguishable from push in practice. Matches the no-new-dependency
 * pattern the rest of this codebase already follows.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => apiClient<{ count: number }>(`${BASE}/unread-count`),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`${BASE}/${id}/read`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient(`${BASE}/read-all`, { method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

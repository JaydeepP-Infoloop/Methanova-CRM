import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./apiClient";
import { queryKeys, type ResourceName } from "./queryKeys";

/**
 * Every module entity is exposed by the API as GET /, GET /:id, POST /,
 * PATCH /:id, DELETE /:id and (for state-machine-driven entities) POST
 * /:id/transition. This factory gives each module's api/*.ts a typed
 * TanStack Query surface over that convention without repeating it.
 *
 * `resource` is the cache namespace and is deliberately separate from
 * `basePath`: keys are a domain concern, not a URL one. Hand-written hooks for
 * the same entity use the same name via `queryKeys`, so one invalidation
 * reaches every query about it.
 */
export function createResourceApi<T>(basePath: string, resource: ResourceName) {
  const all = queryKeys.resource(resource);

  return {
    basePath,
    resource,
    /** Invalidate this to refresh every query about the resource. */
    allKey: all,
    useList: () =>
      useQuery({ queryKey: queryKeys.list(resource), queryFn: () => apiClient<T[]>(basePath) }),
    useItem: (id: string | undefined) =>
      useQuery({
        queryKey: queryKeys.detail(resource, id),
        enabled: Boolean(id),
        queryFn: () => apiClient<T>(`${basePath}/${id}`),
      }),
    useCreate: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (payload: Partial<T>) =>
          apiClient<T>(basePath, { method: "POST", body: JSON.stringify(payload) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: all }),
      });
    },
    useUpdate: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: ({ id, payload }: { id: string; payload: Partial<T> }) =>
          apiClient<T>(`${basePath}/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: all }),
      });
    },
    useRemove: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (id: string) => apiClient<T>(`${basePath}/${id}`, { method: "DELETE" }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: all }),
      });
    },
    useTransition: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: ({ id, to }: { id: string; to: string }) =>
          apiClient<T>(`${basePath}/${id}/transition`, { method: "POST", body: JSON.stringify({ to }) }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: all }),
      });
    },
  };
}

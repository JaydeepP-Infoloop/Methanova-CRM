import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./apiClient";
import { queryKeys, type ResourceName } from "./queryKeys";

/** A list's URL filters — string values only, exactly as they sit in the page's own query string. */
export type ListParams = Record<string, string | undefined>;

/** Appends the defined params as a query string; undefined/empty values are dropped. */
export function withQuery(path: string, params?: ListParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) if (value) query.set(key, value);
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

function hasParams(params?: ListParams): params is ListParams {
  return Boolean(params && Object.values(params).some(Boolean));
}

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
    /** With params, filtered server-side — the list endpoints cap at 100 rows, so filtering a loaded page would be wrong. */
    useList: (params?: ListParams) =>
      useQuery({
        queryKey: queryKeys.list(resource, hasParams(params) ? params : undefined),
        queryFn: () => apiClient<T[]>(withQuery(basePath, params)),
      }),
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

/**
 * Fetch wrappers and React Query hooks for the /api/setup-types endpoints.
 * Not generated from the OpenAPI spec — kept here alongside the other
 * hand-written API wrappers (analysis-api.ts, weeks-api.ts).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";

async function setupTypesFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
}

// ─── types ────────────────────────────────────────────────────────────────────

export interface SetupType {
  id: number;
  userId: number;
  name: string;
  color: string;
  active: boolean;
  createdAt: string;
  description?: string | null;
}

// ─── query key ────────────────────────────────────────────────────────────────

export function setupTypesQueryKey(): readonly unknown[] {
  return ["setup-types"];
}

// ─── fetch functions ──────────────────────────────────────────────────────────

/** Fetch all active setup types for the current user. */
export async function fetchSetupTypes(): Promise<SetupType[]> {
  const res = await setupTypesFetch("/api/setup-types");
  if (!res.ok) throw new Error("Failed to load setup types.");
  return res.json() as Promise<SetupType[]>;
}

/** Create a new setup type. Color is auto-assigned by the server. */
export async function createSetupType(name: string, description?: string): Promise<SetupType> {
  const res = await setupTypesFetch("/api/setup-types", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description: description || undefined }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to create setup type.");
  }
  return res.json() as Promise<SetupType>;
}

/** Patch an existing setup type's name and/or description. */
export async function patchSetupType(
  id: number,
  fields: { name?: string; description?: string | null },
): Promise<SetupType> {
  const res = await setupTypesFetch(`/api/setup-types/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to update setup type.");
  }
  return res.json() as Promise<SetupType>;
}

/** Soft-delete a setup type (sets active = false). Trades that referenced it keep their reference. */
export async function deleteSetupType(id: number): Promise<void> {
  const res = await setupTypesFetch(`/api/setup-types/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to delete setup type.");
  }
}

// ─── hooks ────────────────────────────────────────────────────────────────────

/** Returns the list of active setup types for the current user. */
export function useSetupTypes() {
  return useQuery({
    queryKey: setupTypesQueryKey(),
    queryFn: fetchSetupTypes,
  });
}

/** Mutation to create a new setup type. Invalidates the setup-types list on success. */
export function useCreateSetupType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      createSetupType(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setupTypesQueryKey() });
    },
  });
}

/** Mutation to patch a setup type's name/description. Invalidates the setup-types list on success. */
export function usePatchSetupType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id: number; fields: { name?: string; description?: string | null } }) =>
      patchSetupType(id, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setupTypesQueryKey() });
    },
  });
}

/** Mutation to soft-delete a setup type. Invalidates the setup-types list on success. */
export function useDeleteSetupType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSetupType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: setupTypesQueryKey() });
    },
  });
}

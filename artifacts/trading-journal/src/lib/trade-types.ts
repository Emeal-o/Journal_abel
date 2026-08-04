/**
 * Local type augmentations for trade-related types.
 *
 * The generated types in @workspace/api-client-react (lib/api-client-react/src/generated/)
 * must NEVER be hand-edited — they are overwritten on every `pnpm --filter @workspace/api-spec
 * run codegen` run. Extra fields the server returns (or accepts) beyond the OpenAPI spec live
 * here as intersection types so they survive codegen regeneration.
 *
 * setupTypeId is read/written by the server (trades route) but is intentionally absent from
 * the OpenAPI spec (the spec predates this feature). Until the spec is regenerated to include
 * it, all frontend code that needs setupTypeId imports from this file rather than the generated
 * schema.
 */
import type { Trade, TradeInput, TradeUpdate } from "@workspace/api-client-react";

/**
 * Trade as returned from the server — extends the generated type with setupTypeId
 * and direction, which the server always serialises from the DB row but which are
 * not yet in the OpenAPI spec.
 */
export type TradeWithSetupType = Trade & {
  /** @nullable — ID of the active setup type tagged on this trade, or null if none. */
  setupTypeId?: number | null;
  /** @nullable — "Long" | "Short", or null for legacy trades that pre-date this field. */
  direction?: "Long" | "Short" | null;
};

/**
 * Body for POST /api/trades — extends the generated TradeInput with setupTypeId
 * and direction, accepted by the server defensively outside the schema-validated body.
 */
export type TradeInputWithSetupType = TradeInput & {
  setupTypeId?: number | null;
  direction?: "Long" | "Short" | null;
};

/**
 * Body for PATCH /api/trades/:id — extends the generated TradeUpdate with setupTypeId
 * and direction. Pass null to clear; omit to leave unchanged.
 */
export type TradeUpdateWithSetupType = TradeUpdate & {
  setupTypeId?: number | null;
  direction?: "Long" | "Short" | null;
};

import {
  canTransition,
  InvoiceKind,
  LicenceBundle,
  TRANSITION_MAP,
  type AccessLevel,
  type AppModule,
  type Role,
  type StatefulEntity,
} from "@methanova/shared-types";
import { HttpError } from "../../utils/http.js";

/**
 * The transition graph itself lives in @methanova/shared-types so the web app
 * can offer exactly the moves the server will accept. This module is the
 * server-side enforcement layer on top of it.
 */
export { TRANSITION_MAP };
export type { StatefulEntity };

export function assertTransition(entity: StatefulEntity, from: string, to: string): void {
  if (!canTransition(entity, from, to)) {
    throw new HttpError(409, `Illegal ${entity} transition ${from} -> ${to}`);
  }
}

export function applyStatus<T extends { status: string }>(
  entity: StatefulEntity,
  doc: T,
  to: string,
): T {
  assertTransition(entity, doc.status, to);
  doc.status = to;
  return doc;
}

export const LICENCE_CHECKLIST_BUNDLES: LicenceBundle[] = [
  LicenceBundle.PRE_CTE,
  LicenceBundle.CTE,
  LicenceBundle.CTO,
];

export { InvoiceKind };
export type { AppModule, AccessLevel, Role };

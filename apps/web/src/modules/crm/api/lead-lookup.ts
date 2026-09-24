import { useMemo } from "react";
import { useLeadList } from "./leads.api";

/**
 * The lead list endpoint pages at 100. Scaffold list pages are unpaginated, so
 * a row whose lead falls outside this page resolves to its raw id rather than
 * a wrong name — `RefCell` renders that case honestly and the link still works.
 */
const LOOKUP_PAGE_SIZE = 100;

export interface LeadLabel {
  companyName: string;
  leadCode: string;
}

/**
 * id → { companyName, leadCode } for rows that reference a lead by key.
 *
 * Activities and quotations both carry a bare `leadId`, and an ObjectId in a
 * table column tells a salesperson nothing. Resolving it against the list the
 * inbox already speaks is cheaper than adding a populate to two scaffold
 * endpoints, and keeps this a visual-layer change.
 */
export function useLeadLabels(): Map<string, LeadLabel> {
  const leads = useLeadList({ page: 1, pageSize: LOOKUP_PAGE_SIZE, sort: "companyName" });

  return useMemo(
    () =>
      new Map(
        (leads.data?.items ?? []).map((lead) => [
          lead.id,
          { companyName: lead.companyName, leadCode: lead.leadCode },
        ]),
      ),
    [leads.data],
  );
}

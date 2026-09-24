import { ageingBucket } from "@methanova/shared-types";
import { StatusPill } from "../../../components/StatusPill";

/** Buckets a receipt/invoice date into the ageing bands Accounts reports receivables ageing by — the same bands the API derives for invoices. */
export function AgeingBadge({ since }: { since: string }) {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  return <StatusPill value={ageingBucket(days)} />;
}

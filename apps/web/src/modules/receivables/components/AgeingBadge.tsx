import { StatusPill } from "../../../components/StatusPill";

/** Buckets a receipt/invoice date into the ageing bands Accounts reports receivables ageing by. */
export function AgeingBadge({ since }: { since: string }) {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  const bucket = days <= 0 ? "CURRENT" : days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+";
  return <StatusPill value={bucket} />;
}

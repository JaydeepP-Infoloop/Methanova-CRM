import { StatusPill } from "../../../components/StatusPill";

export function InvoiceStatusBadge({ status }: { status: string }) {
  return <StatusPill value={status} />;
}

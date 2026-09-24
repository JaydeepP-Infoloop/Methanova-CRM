import { StatusPill } from "../../../components/StatusPill";

export function LicenceStatusBadge({ status }: { status: string }) {
  return <StatusPill value={status} />;
}

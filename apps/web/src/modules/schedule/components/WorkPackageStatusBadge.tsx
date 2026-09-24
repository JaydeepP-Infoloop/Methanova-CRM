import { StatusPill } from "../../../components/StatusPill";

export function WorkPackageStatusBadge({ status }: { status: string }) {
  return <StatusPill value={status} />;
}

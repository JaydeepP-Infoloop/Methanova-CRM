import { StatusPill } from "../../../components/StatusPill";

export function ProjectStatusBadge({ status }: { status: string }) {
  return <StatusPill value={status} />;
}

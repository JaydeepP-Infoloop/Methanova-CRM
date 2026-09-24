import { StatusPill } from "../../../components/StatusPill";

export function RoleBadge({ role }: { role: string }) {
  return <StatusPill value={role} />;
}

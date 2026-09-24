import { StatusPill } from "../../../components/StatusPill";

export function DocumentKindBadge({ kind }: { kind: string }) {
  return <StatusPill value={kind} />;
}

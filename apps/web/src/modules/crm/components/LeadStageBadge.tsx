import { StatusPill } from "../../../components/StatusPill";

export function LeadStageBadge({ stage }: { stage: string }) {
  return <StatusPill value={stage} />;
}

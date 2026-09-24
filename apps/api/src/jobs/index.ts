import { registerJob } from "../core/queue/index.js";

registerJob("invoice-overdue", async () => {
  // P3: mark TAX_INVOICE_ISSUED invoices past due as OVERDUE via state-machine.
});

registerJob("receivables-ageing", async () => {
  // P3: compute ageing buckets from unpaid invoices.
});

export function registerDefaultJobs(): void {
  // imported for side-effect registration
}

/**
 * Audit trail entry point. The Mongoose plugin and model live in db/plugins
 * (schemas must register the plugin before compilation), but every other
 * module reaches audit logging through this core/ facade.
 */
export {
  AuditLogModel,
  applyActor,
  auditPlugin,
  writeAudit,
  type AuditLogAttrs,
  type AuditedModel,
} from "../../db/plugins/audit.plugin.js";

import { randomBytes } from "node:crypto";
import { CounterKey, Role } from "@methanova/shared-types";
import bcrypt from "bcryptjs";
import { config } from "../../config/index.js";
import { CounterModel } from "../../core/counters/index.js";
import { MasterDataModel } from "../../modules/admin/master-data/master-data.model.js";
import { RoleRecordModel } from "../../modules/admin/roles/roles.model.js";
import { UserModel } from "../../modules/admin/users/users.model.js";
import { seedMasters } from "./masters.seed.js";

const ROLE_LABELS: Record<Role, string> = {
  [Role.DIRECTOR]: "Director",
  [Role.SALES_HEAD_BDE]: "Sales Head / BDE",
  [Role.LIAISON_COMPLIANCE_OFFICER]: "Liaison & Compliance Officer",
  [Role.DESIGN_ENGINEERING_LEAD]: "Design/Engineering Lead",
  [Role.PROJECT_MANAGER]: "Project Manager",
  [Role.SITE_ENGINEER]: "Site Engineer",
  [Role.ACCOUNTS]: "Accounts",
  [Role.CLIENT]: "Client",
};

async function seedRoles(): Promise<void> {
  for (const role of Object.values(Role)) {
    await RoleRecordModel.updateOne(
      { key: role },
      { $setOnInsert: { key: role, label: ROLE_LABELS[role], description: `${ROLE_LABELS[role]} role` } },
      { upsert: true },
    );
  }
}

async function seedCounters(): Promise<void> {
  for (const key of Object.values(CounterKey)) {
    await CounterModel.updateOne({ key }, { $setOnInsert: { key, seq: 0 } }, { upsert: true });
  }
}

async function seedMasterData(): Promise<void> {
  const existing = await MasterDataModel.findOne({ key: "gst-rates" });
  if (!existing) {
    await MasterDataModel.create({
      key: "gst-rates",
      label: "Default GST rates",
      payload: { cgstBps: 900, sgstBps: 900, igstBps: 1800 },
    });
  }

  // The score above which the qualification modal recommends qualifying. A
  // tunable, not a rule — the decision stays human either way.
  const qualification = await MasterDataModel.findOne({ key: "qualification-settings" });
  if (!qualification) {
    await MasterDataModel.create({
      key: "qualification-settings",
      label: "Qualification settings",
      payload: { recommendThreshold: 60 },
    });
  }

  // Contract value at or above which signMou() requires the caller to hold
  // director-level approval. ₹1 crore is a starting default pending the real
  // SoW figure — edit it from the admin screen once that's known, not here.
  const mouApproval = await MasterDataModel.findOne({ key: "mou-approval-settings" });
  if (!mouApproval) {
    await MasterDataModel.create({
      key: "mou-approval-settings",
      label: "MOU approval settings",
      payload: { thresholdPaise: 1_000_000_000 },
    });
  }

  const orgLetterhead = await MasterDataModel.findOne({ key: "org-letterhead" });
  if (!orgLetterhead) {
    await MasterDataModel.create({
      key: "org-letterhead",
      label: "Org letterhead",
      payload: { fileId: null, legalName: "Methanova Pvt Ltd" },
    });
  }

  const notifications = await MasterDataModel.findOne({ key: "notification-defaults" });
  if (!notifications) {
    await MasterDataModel.create({
      key: "notification-defaults",
      label: "Notification defaults",
      payload: {
        inAppEnabled: true,
        emailEnabled: false,
        taskOverdueToAssignee: true,
        taskOverdueToProjectManager: true,
      },
    });
  }
}

function generateDevPassword(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * Seeds exactly one initial admin (Director) user so there is a way to log
 * in on a fresh database. The password is never hardcoded: it comes from
 * SEED_ADMIN_PASSWORD if set, otherwise a random one is generated and
 * printed once. Re-running the seed against an existing admin is a no-op —
 * it will not reprint or reset the password.
 */
async function seedAdminUser(): Promise<void> {
  const email = (config.seedAdminEmail ?? "admin@methanova.local").toLowerCase();
  const existing = await UserModel.findOne({ email });
  if (existing) {
    return;
  }

  const wasGenerated = !config.seedAdminPassword;
  const password = config.seedAdminPassword ?? generateDevPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  await UserModel.create({ email, name: "Admin", role: Role.DIRECTOR, passwordHash });

  if (wasGenerated) {
    console.warn("=".repeat(64));
    console.warn("DEV ONLY — do not use in production");
    console.warn(`Seeded admin login → email: ${email}  password: ${password}`);
    console.warn("Set SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD to control this on future runs.");
    console.warn("=".repeat(64));
  }
}

export async function seed(): Promise<void> {
  await seedRoles();
  await seedCounters();
  await seedMasterData();
  await seedMasters();
  await seedAdminUser();
}

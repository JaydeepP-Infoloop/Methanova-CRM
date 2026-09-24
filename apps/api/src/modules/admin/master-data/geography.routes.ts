import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router } from "express";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import { HttpError } from "../../../utils/http.js";
import { UserModel } from "../users/users.model.js";
import { MasterDataModel } from "./master-data.model.js";
import {
  createCriterionSchema,
  mouApprovalSettingsSchema,
  notificationDefaultsSchema,
  qualificationSettingsSchema,
  updateCriterionSchema,
} from "./qualification.validation.js";
import {
  DistrictModel,
  FeedstockTypeModel,
  LeadSourceModel,
  LicenceTypeModel,
  QualificationCriterionModel,
  StateModel,
  TalukaModel,
  VillageModel,
} from "./geography.model.js";
import {
  DEFAULT_MOU_APPROVAL_THRESHOLD_PAISE,
  MOU_APPROVAL_SETTINGS_KEY,
} from "../../crm/mou/mou.service.js";
import {
  DEFAULT_NOTIFICATION_DEFAULTS,
  NOTIFICATION_DEFAULTS_KEY,
} from "../../notifications/notifications.service.js";

export const geographyRouter = Router();

/**
 * Read-only reference data. Gated at crm/READ rather than admin: every role
 * that can open the lead intake form needs to resolve these lists, and they
 * contain nothing sensitive.
 */
geographyRouter.use(requireAuth, requirePermission(AppModule.crm, AccessLevel.READ));

function handle(loader: (query: Record<string, unknown>) => Promise<unknown>) {
  return (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    void loader(req.query as Record<string, unknown>)
      .then((data) => res.json(data))
      .catch(next);
  };
}

geographyRouter.get(
  "/states",
  handle(() => StateModel.find().sort({ name: 1 }).select("name code").lean()),
);

geographyRouter.get(
  "/districts",
  handle((query) =>
    DistrictModel.find(query.stateId ? { stateId: query.stateId } : {})
      .sort({ name: 1 })
      .select("name stateId")
      .lean(),
  ),
);

geographyRouter.get(
  "/talukas",
  handle((query) =>
    TalukaModel.find(query.districtId ? { districtId: query.districtId } : {})
      .sort({ name: 1 })
      .select("name districtId")
      .lean(),
  ),
);

geographyRouter.get(
  "/villages",
  handle((query) =>
    VillageModel.find(query.talukaId ? { talukaId: query.talukaId } : {})
      .sort({ name: 1 })
      .select("name talukaId")
      .lean(),
  ),
);

geographyRouter.get(
  "/lead-sources",
  handle(() => LeadSourceModel.find().sort({ sortOrder: 1, label: 1 }).lean()),
);

geographyRouter.get(
  "/feedstock-types",
  handle(() => FeedstockTypeModel.find().sort({ sortOrder: 1, label: 1 }).lean()),
);

geographyRouter.get(
  "/licence-types",
  handle(() => LicenceTypeModel.find().sort({ sortOrder: 1, label: 1 }).lean()),
);

/**
 * Minimal colleague list for owner and participant pickers.
 *
 * This exists separately from GET /api/admin/users because that route is
 * gated at admin/READ, which only the Director holds — a Sales Head assigning
 * a lead has crm/FULL but admin/NONE and would be refused. Only the fields a
 * picker needs are returned; nothing here is sensitive internally.
 */
geographyRouter.get(
  "/qualification-criteria",
  handle(() => QualificationCriterionModel.find().sort({ sortOrder: 1, label: 1 }).lean()),
);

/**
 * Qualification settings live in the generic MasterData collection rather than
 * a bespoke one — a single row of tunables does not earn its own model.
 */
export const QUALIFICATION_SETTINGS_KEY = "qualification-settings";
export const DEFAULT_RECOMMEND_THRESHOLD = 60;

geographyRouter.get(
  "/qualification-settings",
  handle(async () => {
    const row = (await MasterDataModel.findOne({ key: QUALIFICATION_SETTINGS_KEY }).lean()) as
      | { payload?: { recommendThreshold?: number } }
      | null;
    const payload = row?.payload ?? {};
    return { recommendThreshold: payload.recommendThreshold ?? DEFAULT_RECOMMEND_THRESHOLD };
  }),
);

/**
 * Writes are gated at admin/WRITE *on top of* the router's crm/READ gate, so
 * both must pass. A Sales Head can read these criteria to qualify a lead but
 * cannot retune the rubric everyone else is measured by.
 */
const requireAdminWrite = requirePermission(AppModule.admin, AccessLevel.WRITE);

geographyRouter.patch("/qualification-settings", requireAdminWrite, (req, res, next) => {
  void (async () => {
    const body = qualificationSettingsSchema.parse(req.body);
    await MasterDataModel.updateOne(
      { key: QUALIFICATION_SETTINGS_KEY },
      { $set: { payload: body }, $setOnInsert: { key: QUALIFICATION_SETTINGS_KEY, label: "Qualification settings" } },
      { upsert: true },
    );
    res.json(body);
  })().catch(next);
});

/**
 * The Director-approval gate's threshold — key and default live in
 * mou.service.ts (see the comment there for why); this route just reads and
 * writes the same MasterData row `signMou()` reads. Lives in the generic
 * MasterData collection for the same reason qualification-settings does: one
 * tunable number does not earn its own model.
 */
geographyRouter.get(
  "/mou-approval-settings",
  handle(async () => {
    const row = (await MasterDataModel.findOne({ key: MOU_APPROVAL_SETTINGS_KEY }).lean()) as
      | { payload?: { thresholdPaise?: number } }
      | null;
    const payload = row?.payload ?? {};
    return { thresholdPaise: payload.thresholdPaise ?? DEFAULT_MOU_APPROVAL_THRESHOLD_PAISE };
  }),
);

geographyRouter.patch("/mou-approval-settings", requireAdminWrite, (req, res, next) => {
  void (async () => {
    const body = mouApprovalSettingsSchema.parse(req.body);
    await MasterDataModel.updateOne(
      { key: MOU_APPROVAL_SETTINGS_KEY },
      { $set: { payload: body }, $setOnInsert: { key: MOU_APPROVAL_SETTINGS_KEY, label: "MOU approval settings" } },
      { upsert: true },
    );
    res.json(body);
  })().catch(next);
});

geographyRouter.post("/qualification-criteria", requireAdminWrite, (req, res, next) => {
  void (async () => {
    const body = createCriterionSchema.parse(req.body);
    const existing = await QualificationCriterionModel.findOne({ key: body.key });
    if (existing) {
      throw new HttpError(409, `A criterion with key ${body.key} already exists`);
    }
    const doc = new QualificationCriterionModel(body);
    applyActor(doc, req.user?.id, "create");
    res.status(201).json(await doc.save());
  })().catch(next);
});

geographyRouter.patch("/qualification-criteria/:id", requireAdminWrite, (req, res, next) => {
  void (async () => {
    const body = updateCriterionSchema.parse(req.body);
    const doc = await QualificationCriterionModel.findById(req.params.id);
    if (!doc) throw new HttpError(404, "Criterion not found");
    Object.assign(doc, body);
    applyActor(doc, req.user?.id, "update");
    res.json(await doc.save());
  })().catch(next);
});

geographyRouter.delete("/qualification-criteria/:id", requireAdminWrite, (req, res, next) => {
  void (async () => {
    const doc = await QualificationCriterionModel.findById(req.params.id);
    if (!doc) throw new HttpError(404, "Criterion not found");
    // Soft delete only (hard rule #6). Leads already scored against this
    // criterion keep their stored scores, which reference the key.
    res.json(await doc.softDelete(req.user?.id));
  })().catch(next);
});

geographyRouter.get(
  "/users",
  handle(() => UserModel.find().sort({ name: 1 }).select("name email role").lean()),
);

geographyRouter.get(
  "/notification-defaults",
  handle(async () => {
    const row = (await MasterDataModel.findOne({ key: NOTIFICATION_DEFAULTS_KEY }).lean()) as
      | { payload?: Record<string, boolean> }
      | null;
    return { ...DEFAULT_NOTIFICATION_DEFAULTS, ...(row?.payload ?? {}) };
  }),
);

geographyRouter.patch("/notification-defaults", requireAdminWrite, (req, res, next) => {
  void (async () => {
    const body = notificationDefaultsSchema.parse(req.body);
    await MasterDataModel.updateOne(
      { key: NOTIFICATION_DEFAULTS_KEY },
      { $set: { payload: body }, $setOnInsert: { key: NOTIFICATION_DEFAULTS_KEY, label: "Notification defaults" } },
      { upsert: true },
    );
    res.json(body);
  })().catch(next);
});

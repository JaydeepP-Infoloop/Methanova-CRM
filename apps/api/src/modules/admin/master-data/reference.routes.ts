import { AccessLevel, AppModule } from "@methanova/shared-types";
import { Router, type Request, type Response, type NextFunction } from "express";
import type { Model } from "mongoose";
import { z } from "zod";
import { applyActor } from "../../../db/plugins/audit.plugin.js";
import { requireAuth, requirePermission } from "../../../middlewares/index.js";
import { HttpError } from "../../../utils/http.js";
import { LicenceModel } from "../../compliance/licences/licences.model.js";
import { LeadModel } from "../../crm/leads/leads.model.js";
import { recalculateExpectedCbg, summariseFeedstockUsage } from "./feedstock.service.js";
import {
  DistrictModel,
  FeedstockTypeModel,
  LeadSourceModel,
  LicenceTypeModel,
  StateModel,
  TalukaModel,
  VillageModel,
} from "./geography.model.js";

/**
 * Admin CRUD for the reference data the CRM reads. Mounted separately from the
 * read-only masters router because the gating differs: reading geography needs
 * crm/READ (the intake form uses it), editing it needs admin/WRITE.
 */
export const referenceAdminRouter = Router();
referenceAdminRouter.use(requireAuth, requirePermission(AppModule.admin, AccessLevel.WRITE));

function wrap(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch(next);
  };
}

const nameSchema = z.object({ name: z.string().trim().min(1, "Name is required") });
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Must be a valid id");

interface GeoLevel {
  path: string;
  model: Model<unknown>;
  label: string;
  /** Field on this model pointing at its parent, and the parent's model. */
  parentField?: string;
  parentModel?: Model<unknown>;
  parentLabel?: string;
  /** The child level, used to refuse deleting a node that still has children. */
  childModel?: Model<unknown>;
  childField?: string;
  childLabel?: string;
  /** Field on Lead referencing this level, used to refuse deleting one in use. */
  leadField: string;
}

const LEVELS: GeoLevel[] = [
  {
    path: "states",
    model: StateModel as Model<unknown>,
    label: "State",
    childModel: DistrictModel as Model<unknown>,
    childField: "stateId",
    childLabel: "district",
    leadField: "stateId",
  },
  {
    path: "districts",
    model: DistrictModel as Model<unknown>,
    label: "District",
    parentField: "stateId",
    parentModel: StateModel as Model<unknown>,
    parentLabel: "state",
    childModel: TalukaModel as Model<unknown>,
    childField: "districtId",
    childLabel: "taluka",
    leadField: "districtId",
  },
  {
    path: "talukas",
    model: TalukaModel as Model<unknown>,
    label: "Taluka",
    parentField: "districtId",
    parentModel: DistrictModel as Model<unknown>,
    parentLabel: "district",
    childModel: VillageModel as Model<unknown>,
    childField: "talukaId",
    childLabel: "village",
    leadField: "talukaId",
  },
  {
    path: "villages",
    model: VillageModel as Model<unknown>,
    label: "Village",
    parentField: "talukaId",
    parentModel: TalukaModel as Model<unknown>,
    parentLabel: "taluka",
    leadField: "villageId",
  },
];

for (const level of LEVELS) {
  referenceAdminRouter.post(
    `/geography/${level.path}`,
    wrap(async (req, res) => {
      const body = nameSchema
        .extend(level.parentField ? { [level.parentField]: objectId } : {})
        .parse(req.body);

      if (level.parentField && level.parentModel) {
        const parent = await level.parentModel.findById((body as Record<string, string>)[level.parentField]);
        if (!parent) throw new HttpError(400, `Unknown ${level.parentLabel}`);
      }

      // Names are unique within a parent, which the compound indexes also
      // enforce — checking here turns a raw duplicate-key error into a message.
      const scope = level.parentField
        ? { name: body.name, [level.parentField]: (body as Record<string, string>)[level.parentField] }
        : { name: body.name };
      if (await level.model.findOne(scope)) {
        throw new HttpError(409, `${level.label} "${body.name}" already exists here`);
      }

      const doc = new level.model(body);
      applyActor(doc, req.user?.id, "create");
      res.status(201).json(await doc.save());
    }),
  );

  referenceAdminRouter.patch(
    `/geography/${level.path}/:id`,
    wrap(async (req, res) => {
      const body = nameSchema.parse(req.body);
      const doc = await level.model.findById(req.params.id);
      if (!doc) throw new HttpError(404, `${level.label} not found`);
      // Renaming is always safe: leads reference geography by id, not name.
      doc.set("name", body.name);
      applyActor(doc, req.user?.id, "update");
      res.json(await doc.save());
    }),
  );

  referenceAdminRouter.delete(
    `/geography/${level.path}/:id`,
    wrap(async (req, res) => {
      const doc = await level.model.findById(req.params.id);
      if (!doc) throw new HttpError(404, `${level.label} not found`);

      // Refuse rather than orphan. A soft-deleted district whose leads still
      // point at it would silently render as a blank location forever.
      if (level.childModel && level.childField) {
        const children = await level.childModel.countDocuments({ [level.childField]: doc._id });
        if (children > 0) {
          throw new HttpError(
            409,
            `Remove its ${children} ${level.childLabel}${children === 1 ? "" : "s"} first`,
          );
        }
      }

      const inUse = await LeadModel.countDocuments({ [level.leadField]: doc._id });
      if (inUse > 0) {
        throw new HttpError(
          409,
          `${inUse} lead${inUse === 1 ? " uses" : "s use"} this ${level.label.toLowerCase()}`,
        );
      }

      res.json(await (doc as unknown as { softDelete: (actor?: string) => Promise<unknown> }).softDelete(req.user?.id));
    }),
  );
}

const leadSourceCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Key must be UPPER_SNAKE_CASE"),
  label: z.string().trim().min(1, "Label is required"),
  detailLabel: z.string().trim().optional(),
  detailPlaceholder: z.string().trim().optional(),
  detailRequired: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

/** Key is immutable: leads reference the row by id, but the key is the stable business identifier. */
const leadSourceUpdateSchema = leadSourceCreateSchema.omit({ key: true }).partial();

referenceAdminRouter.post(
  "/lead-sources",
  wrap(async (req, res) => {
    const body = leadSourceCreateSchema.parse(req.body);
    if (await LeadSourceModel.findOne({ key: body.key })) {
      throw new HttpError(409, `A lead source with key ${body.key} already exists`);
    }
    const doc = new LeadSourceModel(body);
    applyActor(doc, req.user?.id, "create");
    res.status(201).json(await doc.save());
  }),
);

referenceAdminRouter.patch(
  "/lead-sources/:id",
  wrap(async (req, res) => {
    const body = leadSourceUpdateSchema.parse(req.body);
    const doc = await LeadSourceModel.findById(req.params.id);
    if (!doc) throw new HttpError(404, "Lead source not found");
    Object.assign(doc, body);
    applyActor(doc, req.user?.id, "update");
    res.json(await doc.save());
  }),
);

referenceAdminRouter.delete(
  "/lead-sources/:id",
  wrap(async (req, res) => {
    const doc = await LeadSourceModel.findById(req.params.id);
    if (!doc) throw new HttpError(404, "Lead source not found");
    const inUse = await LeadModel.countDocuments({ leadSourceId: doc._id });
    if (inUse > 0) {
      throw new HttpError(409, `${inUse} lead${inUse === 1 ? "" : "s"} came from this source`);
    }
    res.json(await (doc as unknown as { softDelete: (actor?: string) => Promise<unknown> }).softDelete(req.user?.id));
  }),
);

/**
 * `yieldFactor` is nullable on purpose and null is not the same as 0: null
 * means "we have not decided this yet" and makes the intake form show an em
 * dash, while 0 would be an assertion that this feedstock yields nothing.
 * `z.number().nullable()` keeps that distinction intact through the API.
 */
const feedstockCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Key must be UPPER_SNAKE_CASE"),
  label: z.string().trim().min(1, "Label is required"),
  yieldFactor: z.number().min(0, "A yield factor cannot be negative").nullable().default(null),
  unit: z.string().trim().default("TPD"),
  sortOrder: z.coerce.number().int().default(0),
});

/** Key is immutable: it is the stable business identifier for the feedstock. */
const feedstockUpdateSchema = feedstockCreateSchema.omit({ key: true }).partial();

/**
 * Read separately from `GET /api/masters/feedstock-types` because only the
 * admin screen needs it and it costs a per-type count plus a scan of open
 * leads — the intake form should not pay for that on every page load.
 */
referenceAdminRouter.get(
  "/feedstock-types/usage",
  wrap(async (_req, res) => {
    res.json(await summariseFeedstockUsage());
  }),
);

referenceAdminRouter.post(
  "/feedstock-types/recalculate",
  wrap(async (req, res) => {
    res.json(await recalculateExpectedCbg(req.user?.id));
  }),
);

referenceAdminRouter.post(
  "/feedstock-types",
  wrap(async (req, res) => {
    const body = feedstockCreateSchema.parse(req.body);
    if (await FeedstockTypeModel.findOne({ key: body.key })) {
      throw new HttpError(409, `A feedstock type with key ${body.key} already exists`);
    }
    const doc = new FeedstockTypeModel(body);
    applyActor(doc, req.user?.id, "create");
    res.status(201).json(await doc.save());
  }),
);

referenceAdminRouter.patch(
  "/feedstock-types/:id",
  wrap(async (req, res) => {
    const body = feedstockUpdateSchema.parse(req.body);
    const doc = await FeedstockTypeModel.findById(req.params.id);
    if (!doc) throw new HttpError(404, "Feedstock type not found");
    Object.assign(doc, body);
    applyActor(doc, req.user?.id, "update");
    res.json(await doc.save());
  }),
);

referenceAdminRouter.delete(
  "/feedstock-types/:id",
  wrap(async (req, res) => {
    const doc = await FeedstockTypeModel.findById(req.params.id);
    if (!doc) throw new HttpError(404, "Feedstock type not found");
    const inUse = await LeadModel.countDocuments({ feedstockTypeIds: doc._id });
    if (inUse > 0) {
      throw new HttpError(409, `${inUse} lead${inUse === 1 ? " lists" : "s list"} this feedstock`);
    }
    res.json(await (doc as unknown as { softDelete: (actor?: string) => Promise<unknown> }).softDelete(req.user?.id));
  }),
);

/**
 * The project licence checklist's master data. `bundle`/`scope` reuse the
 * shared enums rather than free text, since `signMou()` reads them straight
 * onto the checklist rows it creates and a typo here would land in every
 * project's compliance record from then on.
 */
const licenceTypeCreateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Key must be UPPER_SNAKE_CASE"),
  label: z.string().trim().min(1, "Label is required"),
  authority: z.string().trim().min(1, "Authority is required"),
  bundle: z.enum(["PRE_CTE", "CTE", "CTO"]),
  scope: z.enum(["METHANOVA", "CLIENT"]),
  expectedVisitCount: z.coerce.number().int().min(0).default(1),
  sortOrder: z.coerce.number().int().default(0),
});

/** Key is immutable: existing Licence checklist rows reference the type by id, but the key is the stable business identifier. */
const licenceTypeUpdateSchema = licenceTypeCreateSchema.omit({ key: true }).partial();

referenceAdminRouter.post(
  "/licence-types",
  wrap(async (req, res) => {
    const body = licenceTypeCreateSchema.parse(req.body);
    if (await LicenceTypeModel.findOne({ key: body.key })) {
      throw new HttpError(409, `A licence type with key ${body.key} already exists`);
    }
    const doc = new LicenceTypeModel(body);
    applyActor(doc, req.user?.id, "create");
    res.status(201).json(await doc.save());
  }),
);

referenceAdminRouter.patch(
  "/licence-types/:id",
  wrap(async (req, res) => {
    const body = licenceTypeUpdateSchema.parse(req.body);
    const doc = await LicenceTypeModel.findById(req.params.id);
    if (!doc) throw new HttpError(404, "Licence type not found");
    Object.assign(doc, body);
    applyActor(doc, req.user?.id, "update");
    res.json(await doc.save());
  }),
);

referenceAdminRouter.delete(
  "/licence-types/:id",
  wrap(async (req, res) => {
    const doc = await LicenceTypeModel.findById(req.params.id);
    if (!doc) throw new HttpError(404, "Licence type not found");
    const inUse = await LicenceModel.countDocuments({ licenceTypeId: doc._id });
    if (inUse > 0) {
      throw new HttpError(409, `${inUse} project checklist${inUse === 1 ? "" : "s"} already list this licence type`);
    }
    res.json(await (doc as unknown as { softDelete: (actor?: string) => Promise<unknown> }).softDelete(req.user?.id));
  }),
);

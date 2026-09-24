import { LicenceBundle, ResponsibleParty } from "@methanova/shared-types";
import mongoose, { Schema } from "mongoose";
import { applyDomainPlugins } from "../../../db/plugins/index.js";

/**
 * Geography is four separate collections rather than one self-referencing
 * tree because the intake form walks it strictly top-down
 * (state → district → taluka → village) and each level is validated against
 * its stated parent. Separate collections make "does this district actually
 * belong to that state" a single indexed lookup instead of a graph walk.
 */

const stateSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String },
  },
  { collection: "geo_states" },
);
applyDomainPlugins(stateSchema);
export const StateModel = mongoose.models.GeoState ?? mongoose.model("GeoState", stateSchema);

const districtSchema = new Schema(
  {
    name: { type: String, required: true },
    stateId: { type: Schema.Types.ObjectId, ref: "GeoState", required: true, index: true },
  },
  { collection: "geo_districts" },
);
districtSchema.index({ stateId: 1, name: 1 }, { unique: true });
applyDomainPlugins(districtSchema);
export const DistrictModel =
  mongoose.models.GeoDistrict ?? mongoose.model("GeoDistrict", districtSchema);

const talukaSchema = new Schema(
  {
    name: { type: String, required: true },
    districtId: { type: Schema.Types.ObjectId, ref: "GeoDistrict", required: true, index: true },
  },
  { collection: "geo_talukas" },
);
talukaSchema.index({ districtId: 1, name: 1 }, { unique: true });
applyDomainPlugins(talukaSchema);
export const TalukaModel = mongoose.models.GeoTaluka ?? mongoose.model("GeoTaluka", talukaSchema);

const villageSchema = new Schema(
  {
    name: { type: String, required: true },
    talukaId: { type: Schema.Types.ObjectId, ref: "GeoTaluka", required: true, index: true },
  },
  { collection: "geo_villages" },
);
villageSchema.index({ talukaId: 1, name: 1 }, { unique: true });
applyDomainPlugins(villageSchema);
export const VillageModel =
  mongoose.models.GeoVillage ?? mongoose.model("GeoVillage", villageSchema);

const leadSourceSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    /** Drives the wizard's source-detail label/placeholder and its required-ness. */
    detailLabel: { type: String },
    detailPlaceholder: { type: String },
    detailRequired: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { collection: "lead_sources" },
);
applyDomainPlugins(leadSourceSchema);
export const LeadSourceModel =
  mongoose.models.LeadSource ?? mongoose.model("LeadSource", leadSourceSchema);

/**
 * Qualification criteria are data, not code: the weights and the pass
 * threshold are commercial judgement that gets revised once there are real
 * leads to calibrate against, and editing a seeded row is cheaper than a
 * deploy. Seeded with the three dimensions PROJECT_CONTEXT §2 names.
 */
const qualificationCriterionSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    description: { type: String },
    /** Relative importance; the score formula normalises by the weights actually used. */
    weight: { type: Number, required: true, default: 1, min: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { collection: "qualification_criteria" },
);
applyDomainPlugins(qualificationCriterionSchema);
export const QualificationCriterionModel =
  mongoose.models.QualificationCriterion ??
  mongoose.model("QualificationCriterion", qualificationCriterionSchema);

const feedstockTypeSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    /**
     * CBG tonnes produced per tonne-per-day of this feedstock. Configurable
     * because it is an engineering assumption that gets revised, and null is
     * meaningful: it means "not yet configured", which the UI must surface as
     * an em dash rather than silently treating as zero.
     */
    yieldFactor: { type: Number, default: null },
    unit: { type: String, default: "TPD" },
    sortOrder: { type: Number, default: 0 },
  },
  { collection: "feedstock_types" },
);
applyDomainPlugins(feedstockTypeSchema);
export const FeedstockTypeModel =
  mongoose.models.FeedstockType ?? mongoose.model("FeedstockType", feedstockTypeSchema);

/**
 * The project licence checklist's own master data — what `signMou()`
 * instantiates one `Licence` row per, instead of the three-row PRE_CTE/CTE/CTO
 * stub with authority hardcoded to "SPCB" it used before. Seeded from the
 * SoW's licence table; edit the seeded rows here if an authority or bundle
 * assignment turns out to be wrong rather than hardcoding a fix elsewhere.
 */
const licenceTypeSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    authority: { type: String, required: true, trim: true },
    bundle: { type: String, required: true, enum: Object.values(LicenceBundle) },
    scope: { type: String, required: true, enum: Object.values(ResponsibleParty) },
    expectedVisitCount: { type: Number, required: true, default: 1, min: 0 },
    sortOrder: { type: Number, default: 0 },
  },
  { collection: "licence_types" },
);
applyDomainPlugins(licenceTypeSchema);
export const LicenceTypeModel =
  mongoose.models.LicenceType ?? mongoose.model("LicenceType", licenceTypeSchema);

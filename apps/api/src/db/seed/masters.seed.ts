import {
  DistrictModel,
  FeedstockTypeModel,
  LeadSourceModel,
  LicenceTypeModel,
  QualificationCriterionModel,
  StateModel,
  TalukaModel,
  VillageModel,
} from "../../modules/admin/master-data/geography.model.js";

/**
 * A minimal but real slice of Gujarat — enough for the intake form's cascading
 * selects to be exercised properly, not a complete gazetteer. Extend via the
 * master-data admin screens when those exist; this seed only fills gaps and
 * never overwrites an existing row, so hand-added geography survives a reseed.
 */
const GUJARAT: Record<string, Record<string, string[]>> = {
  Ahmedabad: {
    Daskroi: ["Bareja", "Vinzol", "Kanbha"],
    Sanand: ["Bol", "Chharodi", "Vasodara"],
    Dholka: ["Koth", "Badarkha"],
  },
  "Banaskantha": {
    Palanpur: ["Gadh", "Jagana", "Malan"],
    Deesa: ["Bhildi", "Rasana"],
    Dhanera: ["Lakhani"],
  },
  Sabarkantha: {
    Himmatnagar: ["Berna", "Gambhoi", "Jamla"],
    Idar: ["Vadali", "Sonasan"],
    Prantij: ["Talod"],
  },
  Kutch: {
    Bhuj: ["Madhapar", "Mundra Road", "Kukma"],
    Anjar: ["Sinugra", "Khedoi"],
    Mandvi: ["Bidada"],
  },
  Surat: {
    Olpad: ["Sayan", "Kim"],
    Bardoli: ["Palsana", "Baben"],
    Mandvi: ["Kadod"],
  },
  Rajkot: {
    Gondal: ["Vasavad", "Moviya"],
    Jetpur: ["Navagadh"],
    Kotda: ["Sangani"],
  },
  Mehsana: {
    Kadi: ["Karannagar", "Nandasan"],
    Visnagar: ["Valam"],
    Vijapur: ["Gozaria"],
  },
};

const LEAD_SOURCES = [
  { key: "INBOUND", label: "Inbound enquiry", sortOrder: 10 },
  { key: "REFERRAL", label: "Referral", detailLabel: "Referred by", detailPlaceholder: "Who referred this lead?", sortOrder: 20 },
  { key: "TENDER", label: "Tender", detailLabel: "Tender reference", detailPlaceholder: "Tender number or portal reference", detailRequired: true, sortOrder: 30 },
  { key: "EXHIBITION_EXPO", label: "Exhibition / expo", detailLabel: "Event name", detailPlaceholder: "Which exhibition or expo?", detailRequired: true, sortOrder: 40 },
  { key: "CONSULTANT", label: "Consultant", detailLabel: "Consultant name", detailPlaceholder: "Which consultant introduced this?", detailRequired: true, sortOrder: 50 },
  { key: "FIELD_VISIT", label: "Field visit", detailLabel: "Visit note", detailPlaceholder: "Where was the site visited?", sortOrder: 60 },
  { key: "WEBSITE", label: "Website", sortOrder: 70 },
  { key: "OTHER", label: "Other", detailLabel: "Details", detailPlaceholder: "How did this lead arrive?", sortOrder: 80 },
];

/**
 * Yield factors are tonnes of CBG per TPD of feedstock. PRESS_MUD is left
 * unconfigured on purpose so the "no yield factor configured" path in the
 * intake form has something real to exercise — the UI must show an em dash
 * there rather than quietly computing a wrong number.
 */
const FEEDSTOCK_TYPES = [
  { key: "CATTLE_DUNG", label: "Cattle dung", yieldFactor: 0.03, sortOrder: 10 },
  { key: "POULTRY_LITTER", label: "Poultry litter", yieldFactor: 0.05, sortOrder: 20 },
  { key: "NAPIER_GRASS", label: "Napier grass", yieldFactor: 0.08, sortOrder: 30 },
  { key: "AGRI_RESIDUE", label: "Agricultural residue", yieldFactor: 0.06, sortOrder: 40 },
  { key: "FOOD_WASTE", label: "Food / kitchen waste", yieldFactor: 0.07, sortOrder: 50 },
  { key: "DISTILLERY_SPENTWASH", label: "Distillery spentwash", yieldFactor: 0.02, sortOrder: 60 },
  { key: "PRESS_MUD", label: "Press mud", yieldFactor: null, sortOrder: 70 },
];

/**
 * Equal weights to start with — deliberately not a guess dressed up as
 * precision. Calibrate once there are enough decided leads to see which
 * dimension actually predicts a deal, then adjust these rows.
 */
const QUALIFICATION_CRITERIA = [
  {
    key: "FEEDSTOCK_AVAILABILITY",
    label: "Feedstock availability",
    description: "Is there a secured, year-round supply at the quantity the plant needs?",
    weight: 1,
    sortOrder: 10,
  },
  {
    key: "SITE_VIABILITY",
    label: "Site viability",
    description: "Land ownership, access, power, water and distance to the offtake point.",
    weight: 1,
    sortOrder: 20,
  },
  {
    key: "BUDGET_FINANCE",
    label: "Budget & finance",
    description: "Ability to fund the project — own equity, debt sanction, or subsidy route.",
    weight: 1,
    sortOrder: 30,
  },
];

/**
 * The project licence checklist's master data, seeded from the SoW's licence
 * table. Authority/bundle/scope/expected-visit-count assignments here are a
 * best-effort first cut against common EPC/BioCNG licensing practice, not a
 * transcription of the SoW document itself — this is exactly what the admin
 * screen exists to correct once the real SoW mapping is confirmed, rather
 * than a value hardcoded somewhere a correction would need a deploy.
 */
const LICENCE_TYPES = [
  { key: "LAND_NA_ORDER", label: "Land NA Order", authority: "District Collector / Revenue Department", bundle: "PRE_CTE", scope: "CLIENT", expectedVisitCount: 1, sortOrder: 10 },
  { key: "VILLAGE_PANCHAYAT_NOC", label: "Village Panchayat NOC", authority: "Gram Panchayat", bundle: "PRE_CTE", scope: "CLIENT", expectedVisitCount: 1, sortOrder: 20 },
  { key: "FOREST_DEPT_NOC", label: "Forest Department NOC", authority: "Forest Department", bundle: "PRE_CTE", scope: "CLIENT", expectedVisitCount: 1, sortOrder: 30 },
  { key: "GOBARDHAN_REGISTRATION", label: "GOBARdhan Registration", authority: "MNRE — GOBARdhan Scheme", bundle: "PRE_CTE", scope: "METHANOVA", expectedVisitCount: 1, sortOrder: 40 },
  { key: "CGWA_GROUNDWATER_NOC", label: "CGWA Groundwater NOC", authority: "Central Ground Water Authority", bundle: "PRE_CTE", scope: "METHANOVA", expectedVisitCount: 1, sortOrder: 50 },
  { key: "LOI_FROM_OMC", label: "LOI from OMC", authority: "Oil Marketing Company", bundle: "PRE_CTE", scope: "METHANOVA", expectedVisitCount: 1, sortOrder: 60 },
  { key: "CONSENT_TO_ESTABLISH", label: "Consent to Establish", authority: "State Pollution Control Board", bundle: "CTE", scope: "METHANOVA", expectedVisitCount: 2, sortOrder: 70 },
  { key: "PESO_LICENCE", label: "PESO Licence", authority: "Petroleum & Explosives Safety Organisation", bundle: "CTE", scope: "METHANOVA", expectedVisitCount: 2, sortOrder: 80 },
  { key: "CHIEF_ELECTRICAL_INSPECTOR_CLEARANCE", label: "Chief Electrical Inspector Clearance", authority: "Chief Electrical Inspector", bundle: "CTE", scope: "METHANOVA", expectedVisitCount: 1, sortOrder: 90 },
  { key: "DISTRICT_FIRE_OFFICER_NOC", label: "District Fire Officer NOC", authority: "District Fire Officer", bundle: "CTE", scope: "METHANOVA", expectedVisitCount: 1, sortOrder: 100 },
  { key: "TPA", label: "TPA", authority: "Third Party Assessment Agency", bundle: "CTO", scope: "METHANOVA", expectedVisitCount: 1, sortOrder: 110 },
  { key: "FACTORY_LICENCE", label: "Factory Licence", authority: "Directorate of Industrial Safety & Health", bundle: "CTO", scope: "METHANOVA", expectedVisitCount: 1, sortOrder: 120 },
  { key: "CONSENT_TO_OPERATE", label: "Consent to Operate", authority: "State Pollution Control Board", bundle: "CTO", scope: "METHANOVA", expectedVisitCount: 2, sortOrder: 130 },
  { key: "PESO_APPROVAL_TO_OPERATE", label: "PESO Approval to Operate", authority: "Petroleum & Explosives Safety Organisation", bundle: "CTO", scope: "METHANOVA", expectedVisitCount: 1, sortOrder: 140 },
];

export async function seedMasters(): Promise<void> {
  const existingState = await StateModel.findOne({ name: "Gujarat" });
  const state =
    existingState ?? (await StateModel.create({ name: "Gujarat", code: "GJ" }));

  for (const [districtName, talukas] of Object.entries(GUJARAT)) {
    const district =
      (await DistrictModel.findOne({ name: districtName, stateId: state._id })) ??
      (await DistrictModel.create({ name: districtName, stateId: state._id }));

    for (const [talukaName, villages] of Object.entries(talukas)) {
      const taluka =
        (await TalukaModel.findOne({ name: talukaName, districtId: district._id })) ??
        (await TalukaModel.create({ name: talukaName, districtId: district._id }));

      for (const villageName of villages) {
        const existing = await VillageModel.findOne({ name: villageName, talukaId: taluka._id });
        if (!existing) {
          await VillageModel.create({ name: villageName, talukaId: taluka._id });
        }
      }
    }
  }

  for (const source of LEAD_SOURCES) {
    await LeadSourceModel.updateOne({ key: source.key }, { $setOnInsert: source }, { upsert: true });
  }

  for (const criterion of QUALIFICATION_CRITERIA) {
    await QualificationCriterionModel.updateOne(
      { key: criterion.key },
      { $setOnInsert: criterion },
      { upsert: true },
    );
  }

  for (const feedstock of FEEDSTOCK_TYPES) {
    await FeedstockTypeModel.updateOne(
      { key: feedstock.key },
      { $setOnInsert: feedstock },
      { upsert: true },
    );
  }

  for (const licenceType of LICENCE_TYPES) {
    await LicenceTypeModel.updateOne(
      { key: licenceType.key },
      { $setOnInsert: licenceType },
      { upsert: true },
    );
  }
}

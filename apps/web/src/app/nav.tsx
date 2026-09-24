import { AppModule } from "@methanova/shared-types";
import {
  CalendarDays,
  ChartColumn,
  Factory,
  FileText,
  Receipt,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { ActivityPage } from "../modules/crm/pages/ActivityPage";
import { LeadPage } from "../modules/crm/pages/LeadPage";
import { MouPage } from "../modules/crm/pages/MouPage";
import { QuotationPage } from "../modules/crm/pages/QuotationPage";
import { ProjectPage } from "../modules/projects/pages/ProjectPage";
import { FeasibilitySurveyPage } from "../modules/projects/pages/FeasibilitySurveyPage";
import { DprPage } from "../modules/projects/pages/DprPage";
import { LicencePage } from "../modules/compliance/pages/LicencePage";
import { DocumentRecordPage } from "../modules/documents/pages/DocumentRecordPage";
import { WorkPackagePage } from "../modules/schedule/pages/WorkPackagePage";
import { ProgressUpdatePage } from "../modules/schedule/pages/ProgressUpdatePage";
import { PaymentSchedulePage } from "../modules/billing/pages/PaymentSchedulePage";
import { InvoicePage } from "../modules/billing/pages/InvoicePage";
import { ReceiptPage } from "../modules/receivables/pages/ReceiptPage";
import { ReportSnapshotPage } from "../modules/reports/pages/ReportSnapshotPage";
import { UserPage } from "../modules/admin/pages/UserPage";
import { RoleRecordPage } from "../modules/admin/pages/RoleRecordPage";
import { MasterDataPage } from "../modules/admin/pages/MasterDataPage";
import { QualificationCriteriaPage } from "../modules/admin/pages/QualificationCriteriaPage";
import { GeographyPage } from "../modules/admin/pages/GeographyPage";
import { LeadSourcesPage } from "../modules/admin/pages/LeadSourcesPage";
import { FeedstockTypesPage } from "../modules/admin/pages/FeedstockTypesPage";
import { LicenceTypesPage } from "../modules/admin/pages/LicenceTypesPage";
import { LetterheadPage } from "../modules/admin/pages/LetterheadPage";
import { NotificationDefaultsPage } from "../modules/admin/pages/NotificationDefaultsPage";

export interface NavItem {
  path: string;
  label: string;
  element: ComponentType;
}

export interface NavSection {
  /** Unique React key and section identity — distinct from `modules` because a section can span more than one permission module. */
  key: string;
  /** The section is visible if the current role has at least READ on ANY of these modules. */
  modules: AppModule[];
  label: string;
  /** Shown in the collapsed rail, where there is no room for labels. */
  icon: LucideIcon;
  items: NavItem[];
}

/**
 * Single source of truth for both the sidebar and the route table, so a
 * module's nav entries and its routes can never drift apart. Route paths are
 * relative to the "/app" parent route (see router.tsx).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "crm",
    modules: [AppModule.crm],
    label: "CRM",
    icon: Users,
    items: [
      // My Day itself is NOT here — it sits above the Dashboard as its own
      // hardcoded sidebar link (see Sidebar.tsx), the same way Dashboard
      // does, because it is the one screen the sales team opens every
      // morning and a CRM sub-section item would bury it a level down.
      { path: "crm/leads", label: "Leads", element: LeadPage },
      { path: "crm/quotations", label: "Quotations", element: QuotationPage },
      { path: "crm/activities", label: "Activities", element: ActivityPage },
      { path: "crm/mou", label: "MOUs", element: MouPage },
    ],
  },
  {
    key: "projects-compliance",
    modules: [AppModule.projects, AppModule.compliance],
    label: "Projects & Compliance",
    icon: Factory,
    items: [
      { path: "projects", label: "Projects", element: ProjectPage },
      { path: "projects/feasibility", label: "Feasibility Surveys", element: FeasibilitySurveyPage },
      { path: "projects/dpr", label: "DPRs", element: DprPage },
      { path: "compliance/licences", label: "Licences & NOCs", element: LicencePage },
    ],
  },
  {
    key: "documents",
    modules: [AppModule.documents],
    label: "Documents",
    icon: FileText,
    items: [{ path: "documents", label: "Documents", element: DocumentRecordPage }],
  },
  {
    key: "schedule",
    modules: [AppModule.schedule],
    label: "Schedule",
    icon: CalendarDays,
    items: [
      { path: "schedule/work-packages", label: "Work Packages", element: WorkPackagePage },
      { path: "schedule/progress-updates", label: "Progress Updates", element: ProgressUpdatePage },
    ],
  },
  {
    key: "billing",
    modules: [AppModule.billing],
    label: "Billing",
    icon: Receipt,
    items: [
      { path: "billing/payment-schedules", label: "Payment Schedules", element: PaymentSchedulePage },
      { path: "billing/invoices", label: "Invoices", element: InvoicePage },
    ],
  },
  {
    key: "receivables",
    modules: [AppModule.receivables],
    label: "Receivables",
    icon: Wallet,
    items: [{ path: "receivables/receipts", label: "Receipts & Ageing", element: ReceiptPage }],
  },
  {
    key: "reports",
    modules: [AppModule.reports],
    label: "Reports",
    icon: ChartColumn,
    items: [{ path: "reports", label: "Reports", element: ReportSnapshotPage }],
  },
  {
    key: "admin",
    modules: [AppModule.admin],
    label: "Admin",
    icon: Settings,
    items: [
      { path: "admin/users", label: "Users", element: UserPage },
      { path: "admin/roles", label: "Roles", element: RoleRecordPage },
      { path: "admin/letterhead", label: "Letterhead", element: LetterheadPage },
      { path: "admin/notifications", label: "Notifications", element: NotificationDefaultsPage },
      { path: "admin/qualification-criteria", label: "Qualification Criteria", element: QualificationCriteriaPage },
      { path: "admin/geography", label: "Geography", element: GeographyPage },
      { path: "admin/lead-sources", label: "Lead Sources", element: LeadSourcesPage },
      { path: "admin/feedstock-types", label: "Feedstock Types", element: FeedstockTypesPage },
      { path: "admin/licence-types", label: "Licence Types", element: LicenceTypesPage },
      { path: "admin/master-data", label: "Master Data", element: MasterDataPage },
    ],
  },
];

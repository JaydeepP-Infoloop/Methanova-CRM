import { Navigate, Route, Routes } from "react-router-dom";
import { LeadDetailPage } from "../modules/crm/pages/LeadDetailPage";
import { MyDayPage } from "../modules/crm/pages/MyDayPage";
import { ProjectDetailPage } from "../modules/projects/pages/ProjectDetailPage";
import { Dashboard } from "../modules/reports/pages/Dashboard";
import { AppShell } from "./layout/AppShell";
import { ProtectedRoute } from "./layout/ProtectedRoute";
import { NAV_SECTIONS } from "./nav";
import { Login } from "./pages/Login";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        {/* My Day sits above Dashboard in the sidebar (see Sidebar.tsx) rather
            than inside a NAV_SECTIONS entry, the same reason Dashboard's own
            route is declared here instead of in nav.tsx. Detail routes are
            declared here for the same reason — neither is a nav destination
            in the section sense. */}
        <Route path="my-day" element={<MyDayPage />} />
        <Route path="crm/leads/:id" element={<LeadDetailPage />} />
        {NAV_SECTIONS.flatMap((section) =>
          section.items.map((item) => <Route key={item.path} path={item.path} element={<item.element />} />),
        )}
        {/* After static `projects/feasibility` and `projects/dpr` so those literals are not captured as an id. */}
        <Route path="projects/:id" element={<ProjectDetailPage />} />
      </Route>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

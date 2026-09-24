import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Skeleton } from "../../components/Skeleton";
import { useAuth } from "../providers";

/**
 * A silhouette of the shell this gate is standing in for — a dark sidebar
 * strip and a lighter content column, the same split `AppShell` itself
 * renders — rather than a bare "Loading…" on an otherwise blank screen.
 */
function AppShellSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-64 shrink-0 space-y-3 bg-methanova-greenDark p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-3/4 bg-white/10" />
        ))}
      </div>
      <div className="flex-1 space-y-4 bg-slate-50 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppShellSkeleton />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />}
              {item.to && !last ? (
                <Link
                  to={item.to}
                  className="rounded hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={last ? "font-medium text-slate-700" : undefined} aria-current={last ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

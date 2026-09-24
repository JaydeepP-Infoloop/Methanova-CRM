function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export interface IdentityCellProps {
  name: string;
  /** The muted second line — site location on a lead, GSTIN on an invoice, email on a user. */
  secondary?: string;
  avatarUrl?: string;
}

/** Two-line identity used wherever a table row is "about" an organisation or a person. */
export function IdentityCell({ name, secondary, avatarUrl }: IdentityCellProps) {
  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-methanova-greenTint text-xs font-semibold text-methanova-green"
        >
          {initials(name)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{name}</p>
        {secondary && <p className="truncate text-xs text-slate-500">{secondary}</p>}
      </div>
    </div>
  );
}

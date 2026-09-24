import { ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { IconButton } from "../../../components/IconButton";
import { PageHeader } from "../../../components/PagePrimitives";
import { Skeleton } from "../../../components/Skeleton";
import { useToast } from "../../../components/Toast";
import { ApiError } from "../../../lib/apiClient";
import {
  useDistricts,
  useStates,
  useTalukas,
  useVillages,
  type GeoOption,
} from "../../crm/api/masters.api";
import {
  useCreateGeography,
  useDeleteGeography,
  useRenameGeography,
  type GeoLevel,
} from "../api/reference.api";

interface ColumnSpec {
  level: GeoLevel;
  title: string;
  /** Field name the API expects for this level's parent. */
  parentField?: string;
}

const COLUMNS: ColumnSpec[] = [
  { level: "states", title: "States" },
  { level: "districts", title: "Districts", parentField: "stateId" },
  { level: "talukas", title: "Talukas", parentField: "districtId" },
  { level: "villages", title: "Villages", parentField: "talukaId" },
];

export function GeographyPage() {
  const toast = useToast();
  const [selected, setSelected] = useState<(string | null)[]>([null, null, null]);
  const [pendingDelete, setPendingDelete] = useState<{ level: GeoLevel; row: GeoOption; title: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const states = useStates();
  const districts = useDistricts(selected[0] ?? "");
  const talukas = useTalukas(selected[1] ?? "");
  const villages = useVillages(selected[2] ?? "");
  const queries = [states, districts, talukas, villages];

  const create = useCreateGeography();
  const rename = useRenameGeography();
  const remove = useDeleteGeography();

  /** Selecting at one level clears everything below it, exactly like the intake cascade. */
  function select(columnIndex: number, id: string) {
    setSelected((current) => current.map((value, index) => (index === columnIndex ? id : index > columnIndex ? null : value)));
  }

  async function addAt(columnIndex: number, name: string) {
    const column = COLUMNS[columnIndex];
    const payload: Record<string, string> = { name };
    if (column.parentField) {
      const parentId = selected[columnIndex - 1];
      if (!parentId) return;
      payload[column.parentField] = parentId;
    }
    try {
      await create.mutateAsync({ level: column.level, payload });
      toast({ message: `${name} added` });
    } catch (caught) {
      toast({ message: caught instanceof ApiError ? caught.message : "Could not add that", tone: "error" });
    }
  }

  async function renameAt(level: GeoLevel, id: string, name: string, original: string) {
    if (!name.trim() || name === original) return;
    try {
      await rename.mutateAsync({ level, id, name: name.trim() });
      toast({ message: `Renamed to ${name.trim()}` });
    } catch (caught) {
      toast({ message: caught instanceof ApiError ? caught.message : "Could not rename that", tone: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Geography"
        subtitle="The state → district → taluka → village chain the lead intake form cascades through. Renaming is always safe; removing is refused while anything still points at it."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        {COLUMNS.map((column, index) => {
          const query = queries[index];
          const rows = (query.data ?? []) as GeoOption[];
          // A column is reachable only once its parent has been chosen.
          const enabled = index === 0 || Boolean(selected[index - 1]);

          return (
            <section key={column.level} className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
              <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">{column.title}</h2>
                {enabled && <span className="text-xs tabular-nums text-slate-400">{rows.length}</span>}
              </header>

              {!enabled ? (
                <p className="px-4 py-8 text-center text-xs text-slate-400">
                  Select a {COLUMNS[index - 1].title.slice(0, -1).toLowerCase()} first
                </p>
              ) : query.isLoading ? (
                <ul className="divide-y divide-slate-100 px-2 py-1.5">
                  {Array.from({ length: 4 }).map((_, rowIndex) => (
                    <li key={rowIndex} className="px-2 py-1.5">
                      <Skeleton className="h-5 w-full" />
                    </li>
                  ))}
                </ul>
              ) : (
                <>
                  <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                    {rows.length === 0 && (
                      <li className="px-4 py-6 text-center text-xs text-slate-400">Nothing here yet</li>
                    )}
                    {rows.map((row) => {
                      const isSelected = selected[index] === row._id;
                      const isLeaf = index === COLUMNS.length - 1;
                      return (
                        <li
                          key={row._id}
                          className={`flex items-center gap-1 px-2 py-1.5 ${isSelected ? "bg-methanova-greenTint/60" : ""}`}
                        >
                          <input
                            aria-label={`${column.title} name`}
                            defaultValue={row.name}
                            onBlur={(event) => void renameAt(column.level, row._id, event.target.value, row.name)}
                            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-slate-800 hover:border-slate-200 focus-visible:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                          />
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ level: column.level, row, title: column.title })}
                            aria-label={`Remove ${row.name}`}
                            className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          {!isLeaf && (
                            <button
                              type="button"
                              onClick={() => select(index, row._id)}
                              aria-label={`Show ${COLUMNS[index + 1].title.toLowerCase()} in ${row.name}`}
                              className={`rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold ${
                                isSelected ? "text-methanova-green" : "text-slate-400 hover:text-slate-700"
                              }`}
                            >
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <AddRow onAdd={(name) => void addAt(index, name)} isPending={create.isPending} label={column.title} />
                </>
              )}
            </section>
          );
        })}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Remove ${pendingDelete?.row.name ?? ""}?`}
        confirmLabel="Remove"
        isPending={remove.isPending}
        error={deleteError}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (!pendingDelete) return;
          setDeleteError(null);
          void remove
            .mutateAsync({ level: pendingDelete.level, id: pendingDelete.row._id })
            .then(() => {
              toast({ message: `${pendingDelete.row.name} removed` });
              setPendingDelete(null);
            })
            .catch((caught: unknown) => {
              // The server refuses when children or leads still reference it,
              // and its message says exactly how many — surface that verbatim.
              setDeleteError(caught instanceof ApiError ? caught.message : "Could not remove that");
            });
        }}
      >
        <p>It stops appearing in the intake form. It cannot be removed while any child or lead still references it.</p>
      </ConfirmDialog>
    </div>
  );
}

function AddRow({ onAdd, isPending, label }: { onAdd: (name: string) => void; isPending: boolean; label: string }) {
  const [value, setValue] = useState("");

  function submit() {
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  }

  return (
    <div className="flex items-center gap-1 border-t border-slate-200 p-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        placeholder={`Add ${label.slice(0, -1).toLowerCase()}…`}
        aria-label={`New ${label.slice(0, -1).toLowerCase()} name`}
        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
      />
      <IconButton
        aria-label={`Add ${label.slice(0, -1).toLowerCase()}`}
        onClick={submit}
        disabled={!value.trim() || isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
      </IconButton>
    </div>
  );
}

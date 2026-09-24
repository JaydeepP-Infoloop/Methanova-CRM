import { nextStates, type StatefulEntity } from "@methanova/shared-types";
import { MoveRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Skeleton } from "./Skeleton";
import { StatusPill } from "./StatusPill";

export interface KanbanCard {
  id: string;
  status: string;
}

export interface KanbanBoardProps<Card extends KanbanCard> {
  /** Which transition graph governs this board. */
  entity: StatefulEntity;
  /** Column order, left to right — the lifecycle order from shared-types. */
  columns: string[];
  cards: Card[];
  renderCard: (card: Card) => ReactNode;
  /** Should resolve once the move is persisted; the board reverts its optimistic state if it rejects. */
  onMove: (card: Card, to: string) => Promise<unknown>;
  isLoading?: boolean;
  emptyHint?: string;
}

/**
 * Pipelines are the natural shape for these lifecycles, but a board makes it
 * very easy to imply a move that the state machine forbids. So legality is
 * enforced in the UI too: illegal columns visibly refuse the drop, and the
 * per-card menu only ever lists states the server would accept. The server
 * remains the authority — this just avoids offering doomed actions.
 */
export function KanbanBoard<Card extends KanbanCard>({
  entity,
  columns,
  cards,
  renderCard,
  onMove,
  isLoading,
  emptyHint = "Nothing here yet.",
}: KanbanBoardProps<Card>) {
  const [dragging, setDragging] = useState<Card | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  async function move(card: Card, to: string) {
    setError(null);
    setPendingId(card.id);
    setMenuFor(null);
    try {
      await onMove(card, to);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not move that card.");
    } finally {
      setPendingId(null);
    }
  }

  const legalTarget = (to: string) => dragging !== null && nextStates(entity, dragging.status).includes(to);

  if (isLoading) {
    // The column set is already known from `columns` even before any cards
    // have arrived, so the placeholder can be the real board shape — real
    // column headers, a couple of pulsing card silhouettes each — not a
    // single line of text standing in for the whole board.
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => (
          <section key={column} className="flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/70 p-2">
            <header className="flex items-center justify-between px-2 py-1.5">
              <StatusPill value={column} />
            </header>
            <div className="flex flex-1 flex-col gap-2">
              {[0, 1].map((cardIndex) => (
                <div key={cardIndex} className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="mt-2 h-3 w-1/2" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
          {error}
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => {
          const columnCards = cards.filter((card) => card.status === column);
          const isTarget = legalTarget(column);
          const isRefusing = dragging !== null && !isTarget && dragging.status !== column;

          return (
            <section
              key={column}
              onDragOver={(event) => {
                // Only a legal column may accept the drop; skipping preventDefault
                // makes the browser show the "no drop" cursor for the rest.
                if (isTarget) event.preventDefault();
              }}
              onDrop={() => {
                if (dragging && isTarget) void move(dragging, column);
                setDragging(null);
              }}
              className={`flex w-72 shrink-0 flex-col rounded-xl bg-slate-100/70 p-2 transition-colors ${
                isTarget ? "ring-2 ring-methanova-gold" : ""
              } ${isRefusing ? "opacity-50" : ""}`}
            >
              <header className="flex items-center justify-between px-2 py-1.5">
                <StatusPill value={column} />
                <span className="text-xs tabular-nums text-slate-500">{columnCards.length}</span>
              </header>

              <div className="flex flex-1 flex-col gap-2">
                {columnCards.length === 0 ? (
                  <p className="px-2 py-4 text-xs text-slate-400">{emptyHint}</p>
                ) : (
                  columnCards.map((card) => {
                    const targets = nextStates(entity, card.status);
                    return (
                      <article
                        key={card.id}
                        draggable={targets.length > 0}
                        onDragStart={() => setDragging(card)}
                        onDragEnd={() => setDragging(null)}
                        className={`rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-200/70 transition-shadow duration-150 motion-reduce:transition-none hover:ring-slate-300 ${
                          targets.length > 0 ? "cursor-grab active:cursor-grabbing" : ""
                        } ${pendingId === card.id ? "opacity-60" : ""}`}
                      >
                        {renderCard(card)}

                        {targets.length > 0 && (
                          <div className="relative mt-2 border-t border-slate-100 pt-2">
                            <button
                              type="button"
                              onClick={() => setMenuFor(menuFor === card.id ? null : card.id)}
                              aria-expanded={menuFor === card.id}
                              aria-label={`Move this item from ${column.replace(/_/g, " ")}`}
                              className="inline-flex items-center gap-1 rounded text-xs text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                            >
                              <MoveRight className="h-3 w-3" aria-hidden="true" />
                              Move
                            </button>
                            {menuFor === card.id && (
                              <ul className="absolute left-0 z-10 mt-1 min-w-[10rem] rounded-lg bg-white p-1 shadow-lg ring-1 ring-slate-200">
                                {targets.map((target) => (
                                  <li key={target}>
                                    <button
                                      type="button"
                                      onClick={() => void move(card, target)}
                                      className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-methanova-gold"
                                    >
                                      {target.replace(/_/g, " ")}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

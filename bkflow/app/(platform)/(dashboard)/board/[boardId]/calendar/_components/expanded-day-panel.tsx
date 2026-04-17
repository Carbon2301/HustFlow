"use client";

import type { ComponentProps } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

import { ExpandedOccurrence } from "./board-calendar/expanded-occurrence";

type ExpandedOccurrenceProps = ComponentProps<typeof ExpandedOccurrence>;

type ExpandedDayPanelProps = Omit<
  ExpandedOccurrenceProps,
  "occurrence"
> & {
  dayKey: string;
  occurrences: ExpandedOccurrenceProps["occurrence"][];
  onClose: () => void;
};

export const ExpandedDayPanel = ({
  dayKey,
  occurrences,
  onClose,
  ...occurrenceProps
}: ExpandedDayPanelProps) => {
  const cards = occurrences.filter((occurrence) => occurrence.item.type === "card");
  const checklistItems = occurrences.filter((occurrence) => occurrence.item.type === "checklist-item");

  return (
    <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-x-2 border-b border-neutral-100 pb-2">
        <p className="text-sm font-semibold text-neutral-800">
          {format(new Date(`${dayKey}T00:00:00`), "EEEE, dd/MM/yyyy", { locale: vi })}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
        >
          Đóng
        </button>
      </div>

      {cards.length > 0 && (
        <div className="mt-3 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Thẻ công việc</h4>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((occurrence) => (
              <ExpandedOccurrence
                key={`expanded:${occurrence.id}`}
                occurrence={occurrence}
                {...occurrenceProps}
              />
            ))}
          </div>
        </div>
      )}

      {checklistItems.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Checklist</h4>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {checklistItems.map((occurrence) => (
              <ExpandedOccurrence
                key={`expanded:${occurrence.id}`}
                occurrence={occurrence}
                {...occurrenceProps}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

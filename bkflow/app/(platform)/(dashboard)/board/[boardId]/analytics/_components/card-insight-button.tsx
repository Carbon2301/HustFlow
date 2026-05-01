"use client";

import type { ReactNode } from "react";

import { useCardModal } from "@/hooks/use-card-modal";

import type { CardInsight } from "../_types";

export const CardInsightButton = ({
  card,
  meta,
}: {
  card: CardInsight;
  meta?: ReactNode;
}) => {
  const cardModal = useCardModal();

  return (
    <button
      type="button"
      onClick={() => cardModal.onOpen(card.id)}
      className="group w-full rounded-xl border border-neutral-200/60 bg-white p-3.5 text-left transition-all duration-200 hover:-translate-x-0.5 hover:border-rose-200 hover:shadow-xs hover:bg-neutral-50/50"
    >
      <div className="flex items-start justify-between gap-x-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="line-clamp-2 text-sm font-bold text-neutral-800 leading-snug">
            {card.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-neutral-400">
            <span className="bg-neutral-100 px-2 py-0.5 rounded text-[10px] text-neutral-500">
              {card.listTitle}
            </span>
            {meta}
          </div>
        </div>
      </div>
      {card.labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {card.labels.slice(0, 5).map((label) => (
            <span
              key={label.id}
              className="h-1.5 w-6 rounded-full"
              title={label.title}
              style={{ backgroundColor: label.color }}
            />
          ))}
        </div>
      )}
    </button>
  );
};

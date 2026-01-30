"use client";

import { Plus } from "lucide-react";

import type { CardWithList } from "@/types";
import { Hint } from "@/components/hint";
import { getColorName } from "@/lib/utils";
import { LabelPopover } from "../label-popover";

interface CardLabelSummaryProps {
  cardId: string;
  boardId: string;
  labels: CardWithList["labels"];
  boardLabels: CardWithList["boardLabels"];
}

export const CardLabelSummary = ({
  cardId,
  boardId,
  labels,
  boardLabels,
}: CardLabelSummaryProps) => {
  return (
    <div className="flex flex-col gap-y-1.5">
      <span className="text-xs font-semibold text-neutral-600 pl-0.5">
        Nhãn
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {labels.map((cardLabel) => (
          <Hint
            key={cardLabel.id}
            description={`Màu: ${getColorName(cardLabel.label.color)}, Tiêu đề: ${cardLabel.label.title || "Không"}`}
            side="bottom"
          >
            <div className="inline-block">
              <LabelPopover
                cardId={cardId}
                boardId={boardId}
                labels={labels}
                boardLabels={boardLabels}
              >
                <button
                  type="button"
                  style={{ backgroundColor: cardLabel.label.color }}
                  className="h-8 min-w-[32px] max-w-[140px] px-3 rounded-md flex items-center font-bold text-neutral-900/90 text-xs shadow-xs border border-black/5 hover:opacity-85 transition cursor-pointer"
                >
                  <span className="truncate">{cardLabel.label.title}</span>
                </button>
              </LabelPopover>
            </div>
          </Hint>
        ))}

        {/* Plus button inside active state to add/remove labels */}
        <LabelPopover
          cardId={cardId}
          boardId={boardId}
          labels={labels}
          boardLabels={boardLabels}
        >
          <button
            type="button"
            className="rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 flex items-center justify-center h-8 w-8 cursor-pointer transition-colors shadow-xs"
            aria-label="Quản lý nhãn"
          >
            <Plus className="h-4 w-4 text-neutral-600" />
          </button>
        </LabelPopover>
      </div>
    </div>
  );
};

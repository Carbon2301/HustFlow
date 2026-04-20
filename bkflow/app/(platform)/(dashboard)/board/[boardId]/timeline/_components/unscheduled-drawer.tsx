"use client";

import { CalendarX2, X } from "lucide-react";

import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";
import type { BoardTimelineCard } from "@/types";

import { getUnscheduledCardMeta } from "../_lib/layout-utils";
import { DependencyPreviewBadge } from "./timeline-bar";

type UnscheduledDrawerProps = {
  cards: BoardTimelineCard[];
  isOpen: boolean;
  onClose: () => void;
  onOpenCard: (cardId: string) => void;
};

export const UnscheduledDrawer = ({
  cards,
  isOpen,
  onClose,
  onOpenCard,
}: UnscheduledDrawerProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="absolute inset-y-3 right-3 z-40 flex w-[min(360px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700">
            <CalendarX2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900">Chưa lên lịch</h2>
            <p className="mt-1 text-xs text-neutral-500">Thẻ chưa có ngày bắt đầu và hạn hoàn thành.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng danh sách chưa lên lịch"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {cards.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-sm text-neutral-400">
            Không có thẻ chưa lên lịch.
          </p>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => (
              <Hint key={card.id} description={`Mở thẻ: ${card.title}`} side="left">
                <button
                  type="button"
                  onClick={() => onOpenCard(card.id)}
                  aria-label={`Mở thẻ: ${card.title}`}
                  className="w-full cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left transition hover:border-neutral-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn(
                        "truncate text-sm font-semibold text-neutral-900",
                        card.isCompleted && "text-neutral-500 line-through",
                      )}>
                        {card.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">{card.listTitle}</p>
                    </div>
                    <DependencyPreviewBadge card={card} />
                  </div>
                  {getUnscheduledCardMeta(card).length > 0 && (
                    <p className="mt-2 truncate text-xs text-neutral-500">
                      {getUnscheduledCardMeta(card).join(" • ")}
                    </p>
                  )}
                  {card.labels.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {card.labels.slice(0, 4).map((label) => (
                        <Hint
                          key={label.id}
                          description={label.title || "Nhãn"}
                          side="top"
                        >
                          <span
                            className="h-1.5 w-8 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                        </Hint>
                      ))}
                    </div>
                  )}
                </button>
              </Hint>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

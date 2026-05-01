"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";

import type { OverdueCardInsight } from "../_types";
import { formatDate } from "../_lib/chart-formatters";
import { CardInsightButton } from "./card-insight-button";
import { ChartPanel } from "./chart-panel";
import { EmptyState } from "./empty-state";

export const OverdueCardsPanel = ({
  overdueCards,
}: {
  overdueCards: OverdueCardInsight[];
}) => {
  const [overdueSort, setOverdueSort] = useState<"asc" | "desc">("asc");

  const sortedOverdueCards = useMemo(
    () =>
      [...overdueCards].sort((left, right) => {
        const diff = new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();

        return overdueSort === "asc" ? diff : -diff;
      }),
    [overdueCards, overdueSort],
  );

  return (
    <ChartPanel
      title={`Danh sách thẻ quá hạn (${sortedOverdueCards.length})`}
      action={
        sortedOverdueCards.length > 1 && (
          <button
            type="button"
            onClick={() => setOverdueSort((current) => (current === "asc" ? "desc" : "asc"))}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-800 shadow-xs cursor-pointer"
            title={overdueSort === "asc" ? "Đổi sang hạn xa nhất trước" : "Đổi sang hạn gần nhất trước"}
          >
            {overdueSort === "asc" ? (
              <ArrowUpAZ className="h-3.5 w-3.5 text-neutral-400" />
            ) : (
              <ArrowDownAZ className="h-3.5 w-3.5 text-neutral-400" />
            )}
            {overdueSort === "asc" ? "Cũ nhất" : "Mới nhất"}
          </button>
        )
      }
    >
      {sortedOverdueCards.length > 0 ? (
        <div className="max-h-[290px] overflow-y-auto pr-1 space-y-2.5 styled-scrollbar">
          {sortedOverdueCards.map((card) => (
            <CardInsightButton
              key={card.id}
              card={card}
              meta={<span className="font-bold text-rose-500">Hạn {formatDate(card.dueDate)}</span>}
            />
          ))}
        </div>
      ) : (
        <EmptyState label="Hiện không có thẻ nào quá hạn." />
      )}
    </ChartPanel>
  );
};

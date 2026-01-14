"use client";

import type {
  Dispatch,
  DragEvent,
  SetStateAction,
} from "react";
import {
  AlertCircle,
  CalendarX2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Hint } from "@/components/hint";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BoardCalendarUnscheduledCard } from "@/types";
import type { BoardCalendarList } from "./types";

type UnscheduledPanelProps = {
  lists: BoardCalendarList[];
  variant: "default" | "split";
  isCollapsed: boolean;
  setIsCollapsed: Dispatch<SetStateAction<boolean>>;
  filtersAreActive: boolean;
  selectedListIds: string[];
  unscheduledCards: BoardCalendarUnscheduledCard[];
  filteredUnscheduledCards: BoardCalendarUnscheduledCard[];
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isUpdatingCardDate: boolean;
  isUpdatingChecklistItemDueDate: boolean;
  draggingUnscheduledCardId: string | null;
  onSelectedListIdsChange: (listIds: string[]) => void;
  onCardClick: (card: BoardCalendarUnscheduledCard) => void;
  onCardDragStart: (
    event: DragEvent<HTMLButtonElement>,
    card: BoardCalendarUnscheduledCard,
  ) => void;
  onCardDragEnd: () => void;
};

type UnscheduledCardProps = {
  card: BoardCalendarUnscheduledCard;
  isUpdatingCardDate: boolean;
  isUpdatingChecklistItemDueDate: boolean;
  draggingUnscheduledCardId: string | null;
  onClick: (card: BoardCalendarUnscheduledCard) => void;
  onDragStart: (
    event: DragEvent<HTMLButtonElement>,
    card: BoardCalendarUnscheduledCard,
  ) => void;
  onDragEnd: () => void;
};

const UnscheduledCard = ({
  card,
  isUpdatingCardDate,
  isUpdatingChecklistItemDueDate,
  draggingUnscheduledCardId,
  onClick,
  onDragStart,
  onDragEnd,
}: UnscheduledCardProps) => (
  <button
    key={card.id}
    type="button"
    draggable={!isUpdatingCardDate && !isUpdatingChecklistItemDueDate}
    onDragStart={(event) => onDragStart(event, card)}
    onDragEnd={onDragEnd}
    onClick={() => onClick(card)}
    className={cn(
      "group/card w-full cursor-pointer rounded-lg border border-neutral-200 bg-white p-2 text-left transition hover:border-violet-200 hover:bg-violet-50 focus-visible:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-100 active:cursor-grabbing disabled:cursor-wait disabled:opacity-60",
      draggingUnscheduledCardId === card.cardId && "opacity-60 ring-2 ring-violet-300",
    )}
    disabled={isUpdatingCardDate || isUpdatingChecklistItemDueDate}
    aria-label={`Mở thẻ ${card.title}`}
  >
    <div className="flex min-w-0 items-start justify-between gap-x-2">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "line-clamp-2 text-sm font-semibold text-neutral-900",
            card.isCompleted && "text-neutral-500 line-through",
          )}
        >
          {card.title}
        </p>
        <p className="mt-1 truncate text-xs text-neutral-500">
          {card.listTitle}
        </p>
      </div>
      {card.isCompleted && (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      )}
    </div>

    {(card.labels.length > 0 || card.assignees.length > 0 || card.commentCount > 0) && (
      <div className="mt-2 flex min-w-0 items-center justify-between gap-x-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {card.labels.slice(0, 4).map((label) => (
            <span
              key={label.id}
              title={label.title || "Nhãn"}
              className="h-2 w-8 rounded-full"
              style={{ backgroundColor: label.color }}
            />
          ))}
          {card.labels.length > 4 && (
            <span className="text-[10px] font-semibold text-neutral-400">
              +{card.labels.length - 4}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-x-2 text-xs text-neutral-500">
          {card.commentCount > 0 && (
            <span className="inline-flex items-center gap-x-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {card.commentCount}
            </span>
          )}
          {card.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {card.assignees.slice(0, 3).map((assignee) => (
                <Avatar
                  key={assignee.id}
                  title={assignee.userName}
                  className="h-5 w-5 border border-white bg-neutral-200"
                >
                  <AvatarImage src={assignee.userImage} alt={assignee.userName} />
                  <AvatarFallback className="text-[9px]">
                    {assignee.userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
              {card.assignees.length > 3 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-neutral-100 px-1 text-[10px] font-semibold text-neutral-500">
                  +{card.assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    )}
  </button>
);

export const UnscheduledPanel = ({
  lists,
  variant,
  isCollapsed,
  setIsCollapsed,
  filtersAreActive,
  selectedListIds,
  unscheduledCards,
  filteredUnscheduledCards,
  isLoading,
  isError,
  isSuccess,
  isUpdatingCardDate,
  isUpdatingChecklistItemDueDate,
  draggingUnscheduledCardId,
  onSelectedListIdsChange,
  onCardClick,
  onCardDragStart,
  onCardDragEnd,
}: UnscheduledPanelProps) => {
  if (isCollapsed) {
    return null;
  }

  const countLabel = filtersAreActive
    ? `${filteredUnscheduledCards.length}/${unscheduledCards.length}`
    : `${filteredUnscheduledCards.length}`;

  return (
    <aside
      className={cn(
        "flex min-h-0 w-full shrink-0 flex-col rounded-lg border border-white/20 bg-white/95 shadow-xl backdrop-blur",
        variant === "split" && isCollapsed && "lg:w-[180px]",
        variant === "split" && !isCollapsed && "lg:w-[260px] xl:w-[300px]",
        variant === "default" && "lg:w-[340px]",
      )}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-x-3 border-b border-neutral-200 px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-x-2">
            <h2 className="truncate text-sm font-semibold text-neutral-900">
              Chưa lên lịch
            </h2>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
              {countLabel}
            </span>
          </div>
        </div>
        <Hint description={isCollapsed ? "Mở panel" : "Thu gọn panel"} side="top">
          <button
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
            aria-label={isCollapsed ? "Mở panel chưa lên lịch" : "Thu gọn panel chưa lên lịch"}
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </Hint>
      </div>

      {!isCollapsed && (
        <>
          <div className="grid shrink-0 gap-2 border-b border-neutral-100 p-3">
            <select
              value={selectedListIds[0] ?? "all"}
              onChange={(event) =>
                onSelectedListIdsChange(
                  event.target.value === "all" ? [] : [event.target.value],
                )
              }
              className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
              aria-label="Lọc thẻ chưa lên lịch theo danh sách"
            >
              <option value="all">Tất cả danh sách</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
          </div>

          <div className="min-h-[160px] flex-1 overflow-y-auto p-3">
            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-20 rounded-lg bg-neutral-100" />
                <Skeleton className="h-20 rounded-lg bg-neutral-100" />
                <Skeleton className="h-20 rounded-lg bg-neutral-100" />
              </div>
            )}

            {isError && (
              <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-red-100 bg-red-50 px-3 text-center text-red-700">
                <AlertCircle className="mb-2 h-5 w-5" />
                <p className="text-xs font-semibold">
                  Không tải được thẻ chưa lên lịch.
                </p>
              </div>
            )}

            {isSuccess && filteredUnscheduledCards.length > 0 && (
              <div className="space-y-2">
                {filteredUnscheduledCards.map((card) => (
                  <UnscheduledCard
                    key={card.id}
                    card={card}
                    isUpdatingCardDate={isUpdatingCardDate}
                    isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
                    draggingUnscheduledCardId={draggingUnscheduledCardId}
                    onClick={onCardClick}
                    onDragStart={onCardDragStart}
                    onDragEnd={onCardDragEnd}
                  />
                ))}
              </div>
            )}

            {isSuccess && filteredUnscheduledCards.length === 0 && (
              <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 text-center">
                <CalendarX2 className="mb-2 h-5 w-5 text-neutral-400" />
                <p className="text-xs font-semibold text-neutral-700">
                  {unscheduledCards.length === 0
                    ? "Không có thẻ chưa lên lịch."
                    : "Không có thẻ phù hợp với bộ lọc."}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
};

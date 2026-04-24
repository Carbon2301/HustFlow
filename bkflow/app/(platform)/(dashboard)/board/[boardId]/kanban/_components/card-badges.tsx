"use client";

import { CheckSquare, LockKeyhole, MessageSquare, Paperclip } from "lucide-react";

import { DueDateBadge } from "@/components/due-date-badge";
import { Hint } from "@/components/hint";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn, getColorName } from "@/lib/utils";
import type { CardBadgesProps } from "../_types";

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

export const CardLabels = ({
  card,
}: CardBadgesProps) => {
  if (!card.labels || card.labels.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-0 left-0 right-0 flex h-2 gap-x-0.5">
      {card.labels.map((cardLabel) => (
        <Hint
          key={cardLabel.id}
          description={`Màu: ${getColorName(cardLabel.label.color)}, Tiêu đề: ${cardLabel.label.title || "Không"}`}
          side="top"
          sideOffset={4}
        >
          <div
            className="h-full flex-1"
            style={{ backgroundColor: cardLabel.label.color }}
          />
        </Hint>
      ))}
    </div>
  );
};

export const CardBadges = ({
  card,
}: CardBadgesProps) => {
  const visibleAssignees = card.assignees.slice(0, 3);
  const hiddenAssigneesCount = Math.max(card.assignees.length - visibleAssignees.length, 0);

  const fallbackChecklistTotalItems = card.checklists?.reduce((acc, cl) => acc + cl.items.length, 0) ?? 0;
  const fallbackChecklistCompletedItems = card.checklists?.reduce(
    (acc, cl) => acc + cl.items.filter((item) => item.isCompleted).length,
    0,
  ) ?? 0;
  const checklistTotalItems = card.checklistProgress?.total ?? fallbackChecklistTotalItems;
  const checklistCompletedItems = card.checklistProgress?.completed ?? fallbackChecklistCompletedItems;
  const hasChecklistProgress = checklistTotalItems > 0;
  const isChecklistAllDone = hasChecklistProgress && checklistCompletedItems === checklistTotalItems;

  const attachmentCount = card._count?.attachments ?? 0;
  const hasAttachments = attachmentCount > 0;
  const unresolvedBlockerCount = card.unresolvedBlockerCount ?? 0;
  const isBlocked = unresolvedBlockerCount > 0;

  const hasFooter = Boolean(card.dueDate) || Boolean(card.startDate) || card.isCompleted || card.assignees.length > 0
    || Boolean(card._count && card._count.comments > 0) || hasChecklistProgress || hasAttachments || isBlocked;

  if (!hasFooter) {
    return null;
  }

  return (
    <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
      <div className="flex items-center gap-x-1.5 flex-wrap gap-y-1">
        {(card.dueDate || card.startDate) && (
          <DueDateBadge
            dueDate={card.dueDate}
            startDate={card.startDate}
            isCompleted={card.isCompleted}
            isCard
          />
        )}
        {!card.dueDate && card.isCompleted && (
          <Hint description="Thẻ đã hoàn thành" side="bottom">
            <span className="inline-flex h-7 items-center gap-x-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-semibold shadow-xs">
              <CheckSquare className="h-3 w-3.5 text-emerald-600 shrink-0" />
              Hoàn thành
            </span>
          </Hint>
        )}
        {isBlocked && (
          <Hint description={`Bị chặn bởi ${unresolvedBlockerCount} thẻ khác`} side="bottom">
            <div className="flex items-center gap-x-1 text-xs py-0.5 px-1.5 rounded border border-rose-200 bg-rose-50 text-rose-700">
              <LockKeyhole className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
              <span className="font-semibold leading-none">
                {unresolvedBlockerCount}
              </span>
            </div>
          </Hint>
        )}
        {card._count && card._count.comments > 0 && (
          <Hint description={`${card._count.comments} bình luận`} side="bottom">
            <div className="flex items-center gap-x-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors py-0.5 px-1.5 rounded bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-100">
              <MessageSquare className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
              <span className="font-semibold text-neutral-500 leading-none">{card._count.comments}</span>
            </div>
          </Hint>
        )}
        {hasAttachments && (
          <Hint description={`${attachmentCount} tệp đính kèm`} side="bottom">
            <div className="flex items-center gap-x-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors py-0.5 px-1.5 rounded bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-100">
              <Paperclip className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
              <span className="font-semibold text-neutral-500 leading-none">{attachmentCount}</span>
            </div>
          </Hint>
        )}
        {hasChecklistProgress && (
          <Hint description={`${checklistCompletedItems}/${checklistTotalItems} mục hoàn thành`} side="bottom">
            <div className={cn(
              "flex items-center gap-x-1 text-xs py-0.5 px-1.5 rounded border transition-colors",
              isChecklistAllDone
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-neutral-50 border-neutral-100 text-neutral-500 hover:bg-neutral-100/70",
            )}>
              <CheckSquare className={cn("h-3.5 w-3.5 flex-shrink-0", isChecklistAllDone ? "text-emerald-600" : "text-neutral-400")} />
              <span className="font-semibold leading-none">
                {checklistCompletedItems}/{checklistTotalItems}
              </span>
            </div>
          </Hint>
        )}
      </div>
      {card.assignees.length > 0 && (
        <AvatarGroup className="-mr-1 ml-auto flex-shrink-0 -space-x-1.5 *:data-[slot=avatar]:ring-white">
          {visibleAssignees.map((assignee) => (
            <Hint
              key={assignee.id}
              description={assignee.boardMember.userName}
            >
              <Avatar size="sm" className="h-6 w-6 bg-white">
                <AvatarImage
                  src={assignee.boardMember.userImage}
                  alt={assignee.boardMember.userName}
                />
                <AvatarFallback className="text-[10px] font-semibold">
                  {getInitials(assignee.boardMember.userName)}
                </AvatarFallback>
              </Avatar>
            </Hint>
          ))}
          {hiddenAssigneesCount > 0 && (
            <Hint description={`Còn ${hiddenAssigneesCount} người phụ trách khác`}>
              <div className="relative flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-600 ring-2 ring-white">
                +{hiddenAssigneesCount}
              </div>
            </Hint>
          )}
        </AvatarGroup>
      )}
    </div>
  );
};

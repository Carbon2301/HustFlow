"use client";

import { Loader2, Trash2 } from "lucide-react";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { useCardModal } from "@/hooks/use-card-modal";

import { DependencyStatus } from "./dependency-status";
import type { DependencyListItem } from "./dependency-utils";

const DependencyItem = ({
  item,
  canEdit,
  isDeleting,
  onDelete,
}: {
  item: DependencyListItem;
  canEdit: boolean;
  isDeleting: boolean;
  onDelete: (item: DependencyListItem) => void;
}) => {
  const cardModal = useCardModal();

  return (
    <li className="group flex items-center justify-between gap-x-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 transition-colors hover:border-neutral-300 hover:bg-neutral-50">
      <button
        type="button"
        disabled={isDeleting}
        onClick={() => cardModal.onOpen(item.relatedCard.id)}
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <p className="truncate text-sm font-semibold text-neutral-800 group-hover:text-violet-700">
          {item.relatedCard.title}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-x-2">
        <DependencyStatus relatedCard={item.relatedCard} />
        {canEdit && (
          <Hint description="Gỡ liên kết phụ thuộc">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isDeleting}
              onClick={() => onDelete(item)}
              className="h-7 w-7 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Gỡ liên kết phụ thuộc"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </Hint>
        )}
      </div>
    </li>
  );
};

export const DependencyList = ({
  title,
  emptyLabel,
  items,
  canEdit,
  deletingDependencyId,
  onDelete,
}: {
  title: string;
  emptyLabel: string;
  items: DependencyListItem[];
  canEdit: boolean;
  deletingDependencyId: string | null;
  onDelete: (item: DependencyListItem) => void;
}) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {title}
    </p>
    {items.length === 0 ? (
      <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        {emptyLabel}
      </p>
    ) : (
      <ul className="space-y-2">
        {items.map((item) => (
          <DependencyItem
            key={item.dependency.id}
            item={item}
            canEdit={canEdit}
            isDeleting={deletingDependencyId === item.dependency.id}
            onDelete={onDelete}
          />
        ))}
      </ul>
    )}
  </div>
);

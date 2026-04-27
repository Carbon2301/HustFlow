"use client";

import { useMemo } from "react";
import { GitBranch } from "lucide-react";

import type { CardWithList } from "@/types";

import { DependencyList } from "./dependency-list";
import { DependencySearchPicker } from "./dependency-search-picker";
import { useDependencyActions } from "./use-dependency-actions";

interface DependenciesSectionProps {
  data: CardWithList;
  canEdit?: boolean;
}

export const DependenciesSection = ({
  data,
  canEdit = true,
}: DependenciesSectionProps) => {
  const blockedByItems = data.blockedByDependencies.map((dependency) => ({
    dependency,
    relatedCard: dependency.blockerCard,
  }));
  const blockingItems = data.blockingDependencies.map((dependency) => ({
    dependency,
    relatedCard: dependency.blockedCard,
  }));
  const hasDependencies = blockedByItems.length > 0 || blockingItems.length > 0;
  const linkedBlockerIds = useMemo(
    () => new Set(data.blockedByDependencies.map((dependency) => dependency.blockerCardId)),
    [data.blockedByDependencies],
  );
  const linkedBlockeeIds = useMemo(
    () => new Set(data.blockingDependencies.map((dependency) => dependency.blockedCardId)),
    [data.blockingDependencies],
  );
  const {
    deletingDependencyId,
    isCreating,
    onCreateDependency,
    onDeleteDependency,
  } = useDependencyActions({
    boardId: data.list.boardId,
    cardId: data.id,
  });

  if (!canEdit && !hasDependencies) {
    return null;
  }

  return (
    <div className="flex w-full items-start gap-x-4">
      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-100">
        <GitBranch className="h-5 w-5 text-neutral-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-x-3">
          <p className="text-base font-semibold text-neutral-800">
            Phụ thuộc
          </p>
          {canEdit && (
            <DependencySearchPicker
              data={data}
              linkedBlockerIds={linkedBlockerIds}
              linkedBlockeeIds={linkedBlockeeIds}
              isCreating={isCreating}
              onCreateDependency={onCreateDependency}
            />
          )}
        </div>

        <div className="space-y-4">
          <DependencyList
            title="Đang bị chặn bởi"
            emptyLabel="Thẻ này chưa bị thẻ nào chặn."
            items={blockedByItems}
            canEdit={canEdit}
            deletingDependencyId={deletingDependencyId}
            onDelete={onDeleteDependency}
          />
          <DependencyList
            title="Đang chặn"
            emptyLabel="Thẻ này chưa chặn thẻ nào."
            items={blockingItems}
            canEdit={canEdit}
            deletingDependencyId={deletingDependencyId}
            onDelete={onDeleteDependency}
          />
        </div>
      </div>
    </div>
  );
};

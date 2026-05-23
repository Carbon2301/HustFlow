"use client";

import { Trash } from "lucide-react";

import { Hint } from "@/components/hint";

interface ChecklistItemActionsProps {
  isPending: boolean;
  onDelete: () => void;
}

export const ChecklistItemActions = ({
  isPending,
  onDelete,
}: ChecklistItemActionsProps) => {
  return (
    <Hint description="Xoá mục công việc">
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        className="rounded-md p-1 text-neutral-400 opacity-100 transition hover:bg-neutral-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        aria-label="Xoá mục công việc"
      >
        <Trash className="h-4 w-4" />
      </button>
    </Hint>
  );
};

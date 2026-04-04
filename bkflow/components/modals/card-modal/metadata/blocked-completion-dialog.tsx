"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CardDependencyWithBlockerCard } from "@/types";

interface BlockedCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockers: CardDependencyWithBlockerCard[];
  isLoading?: boolean;
  onConfirm: () => void;
}

export const BlockedCompletionDialog = ({
  open,
  onOpenChange,
  blockers,
  isLoading = false,
  onConfirm,
}: BlockedCompletionDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (isLoading) {
        return;
      }

      onOpenChange(nextOpen);
    }}>
      <DialogContent className="w-[calc(100vw-24px)] max-w-[460px] rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-x-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <DialogTitle className="text-lg font-semibold text-neutral-900">
              Cảnh báo tiến độ
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm leading-relaxed text-neutral-600">
            Thẻ này hiện đang bị chặn bởi các thẻ sau chưa hoàn thành:
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/70 p-2">
          <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {blockers.map((dependency) => (
              <div
                key={dependency.id}
                className="flex items-center justify-between gap-x-3 rounded-lg bg-white px-3 py-2 text-sm text-neutral-700 shadow-xs"
              >
                <span className="min-w-0 truncate font-medium">
                  {dependency.blockerCard.title}
                </span>
                {dependency.blockerCard.archivedAt && (
                  <span className="shrink-0 rounded-md border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                    Đã lưu trữ
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
            className="h-9 w-full rounded-xl border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 sm:w-auto"
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isLoading}
            onClick={onConfirm}
            className="h-9 w-full rounded-xl sm:w-auto"
          >
            {isLoading ? "Đang hoàn thành..." : "Vẫn hoàn thành"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

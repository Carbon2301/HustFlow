"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Checklist, ChecklistItem } from "@prisma/client";

import { useAction } from "@/hooks/use-action";
import { createChecklist } from "@/actions/create-checklist";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChecklistPopoverProps {
  cardId: string;
  boardId: string;
  boardChecklists: (Checklist & {
    items: ChecklistItem[];
    card: {
      title: string;
    };
  })[];
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export const ChecklistPopover = ({
  cardId,
  boardId,
  boardChecklists,
  children,
  side = "bottom",
  align = "start",
}: ChecklistPopoverProps) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("Việc cần làm");
  const [copyFromChecklistId, setCopyFromChecklistId] = useState("");

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTitle("Việc cần làm");
      setCopyFromChecklistId("");
    }
  };

  const { execute, isLoading } = useAction(createChecklist, {
    onSuccess: (data) => {
      toast.success(`Đã thêm danh sách việc cần làm "${data.title}"`);
      queryClient.invalidateQueries({
        queryKey: ["card", cardId],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", cardId],
      });
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    execute({
      boardId,
      cardId,
      title,
      copyFromChecklistId: copyFromChecklistId || undefined,
    });
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange} modal={true}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-[280px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999]"
        sideOffset={6}
      >
        <div className="space-y-3">
          {/* Header */}
          <div className="relative pb-2 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-700 mx-auto">
              Thêm danh sách việc cần làm
            </span>
            <PopoverClose asChild>
              <button
                type="button"
                className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </PopoverClose>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Title Input */}
            <div className="flex flex-col gap-y-1.5">
              <label
                htmlFor="checklist-title"
                className="text-xs font-semibold text-neutral-500"
              >
                Tiêu đề
              </label>
              <Input
                id="checklist-title"
                placeholder="Việc cần làm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
                className="h-9 px-3 rounded-lg border-neutral-200 text-xs"
              />
            </div>

            {/* Copy Dropdown */}
            <div className="flex flex-col gap-y-1.5">
              <label
                htmlFor="copy-source"
                className="text-xs font-semibold text-neutral-500"
              >
                Sao chép mục từ...
              </label>
              <select
                id="copy-source"
                value={copyFromChecklistId}
                onChange={(e) => setCopyFromChecklistId(e.target.value)}
                disabled={isLoading}
                className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-xs text-neutral-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 cursor-pointer"
              >
                <option value="">(không có)</option>
                {boardChecklists.map((chk) => (
                  <option key={chk.id} value={chk.id}>
                    {chk.card.title} / {chk.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-8.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              Thêm
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
};

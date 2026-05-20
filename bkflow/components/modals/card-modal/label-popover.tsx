"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  X, 
  ChevronLeft, 
  Search, 
  Check, 
  Pencil 
} from "lucide-react";

import { Label, CardLabel } from "@prisma/client";
import { useAction } from "@/hooks/use-action";
import { createLabel } from "@/actions/labels/create-label";
import { updateLabel } from "@/actions/labels/update-label";
import { deleteLabel } from "@/actions/labels/delete-label";
import { toggleCardLabel } from "@/actions/labels/toggle-card-label";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { patchBoardCardPreview, patchCardQueryData } from "./card-cache-utils";

const LABEL_COLORS = [
  // Hàng 1
  "#bbf7d0", "#fef08a", "#fed7aa", "#fecaca", "#f3e8ff",
  // Hàng 2
  "#4ade80", "#facc15", "#fb923c", "#f87171", "#c084fc",
  // Hàng 3
  "#15803d", "#a16207", "#c2410c", "#b91c1c", "#7e22ce",
  // Hàng 4
  "#dbeafe", "#e0f2fe", "#d9f99d", "#fce7f3", "#e5e7eb",
  // Hàng 5
  "#3b82f6", "#0ea5e9", "#84cc16", "#db2777", "#9ca3af",
  // Hàng 6
  "#1d4ed8", "#0369a1", "#4d7c0f", "#9d174d", "#4b5563"
];

interface LabelPopoverProps {
  cardId: string;
  boardId: string;
  labels: (CardLabel & { label: Label })[];
  boardLabels: Label[];
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export const LabelPopover = ({
  cardId,
  boardId,
  labels,
  boardLabels,
  children,
  side = "bottom",
  align = "start",
}: LabelPopoverProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);

  const [isOpen, setIsOpen] = useState(false);
  const [screen, setScreen] = useState<"select" | "create" | "edit">("select");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const labelRollbackRef = useRef<Map<string, {
    previousLabels: (CardLabel & { label: Label })[];
    version: number;
  }>>(new Map());
  const labelRequestVersionsRef = useRef<Map<string, number>>(new Map());

  // Form states
  const [titleValue, setTitleValue] = useState("");
  const [colorValue, setColorValue] = useState("#0ea5e9"); // defaults to row 5, col 2

  // Reset popover state when closed
  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setTimeout(() => {
        setScreen("select");
        setSearchQuery("");
        setEditingLabelId(null);
        setTitleValue("");
        setColorValue("#0ea5e9");
      }, 200);
    }
  };

  const invalidateCardQueries = () => {
    queryClient.invalidateQueries({
      queryKey: ["card", cardId],
    });
    queryClient.invalidateQueries({
      queryKey: ["card-logs", cardId],
    });
    invalidateBoardCalendar();
  };

  // Actions
  const getNextLabelRequestVersion = (labelId: string) => {
    const nextVersion = (labelRequestVersionsRef.current.get(labelId) ?? 0) + 1;
    labelRequestVersionsRef.current.set(labelId, nextVersion);
    return nextVersion;
  };

  const executeToggle = async (labelId: string, version: number) => {
    const result = await toggleCardLabel({
      cardId,
      labelId,
      boardId,
    });

    if (result.error) {
      const rollback = labelRollbackRef.current.get(labelId);

      if (rollback && rollback.version === version) {
        patchCardQueryData(queryClient, cardId, {
          labels: rollback.previousLabels,
        });
        patchBoardCardPreview(boardId, cardId, {
          labels: rollback.previousLabels,
        });
        labelRollbackRef.current.delete(labelId);
      }

      toast.error(result.error);
      return;
    }

    if (result.data) {
      const rollback = labelRollbackRef.current.get(result.data.labelId);

      if (rollback && rollback.version === version) {
        labelRollbackRef.current.delete(result.data.labelId);
        invalidateCardQueries();
      }
    }
  };

  const { execute: executeCreate, isLoading: isLoadingCreate } = useAction(createLabel, {
    onSuccess: (data) => {
      toast.success(`Đã tạo và gắn nhãn "${data.title || "không tên"}"`);
      const nextLabels = [
        ...labels,
        {
          id: `temp-cl-${new Date().getTime()}`,
          cardId,
          labelId: data.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          label: data,
        },
      ];

      patchCardQueryData(queryClient, cardId, {
        labels: nextLabels,
      });
      patchBoardCardPreview(boardId, cardId, {
        labels: nextLabels,
      });

      invalidateCardQueries();
      setScreen("select");
      setTitleValue("");
      setColorValue("#0ea5e9");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeUpdate, isLoading: isLoadingUpdate } = useAction(updateLabel, {
    onSuccess: () => {
      invalidateCardQueries();
      router.refresh();
      setScreen("select");
      setEditingLabelId(null);
      setTitleValue("");
      setColorValue("#0ea5e9");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeDelete, isLoading: isLoadingDelete } = useAction(deleteLabel, {
    onSuccess: (data) => {
      toast.success(`Đã xóa nhãn "${data.title || "không tên"}" khỏi bảng`);
      invalidateCardQueries();
      router.refresh();
      setScreen("select");
      setEditingLabelId(null);
      setTitleValue("");
      setColorValue("#0ea5e9");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  // Action Triggers
  const handleToggleLabel = (labelId: string) => {
    const currentLabels =
      queryClient.getQueryData<{ labels?: (CardLabel & { label: Label })[] }>(["card", cardId])?.labels ??
      labels;
    const isAttached = currentLabels.some((item) => item.labelId === labelId);
    const labelToAttach = boardLabels.find((label) => label.id === labelId);
    const nextLabels = isAttached
      ? currentLabels.filter((item) => item.labelId !== labelId)
      : labelToAttach
        ? [
          ...currentLabels,
          {
            id: `temp-cl-${cardId}-${labelId}`,
            cardId,
            labelId,
            createdAt: new Date(),
            updatedAt: new Date(),
            label: labelToAttach,
          },
        ]
        : currentLabels;

    const version = getNextLabelRequestVersion(labelId);

    labelRollbackRef.current.set(labelId, {
      previousLabels: currentLabels,
      version,
    });
    patchCardQueryData(queryClient, cardId, {
      labels: nextLabels,
    });
    patchBoardCardPreview(boardId, cardId, {
      labels: nextLabels,
    });

    void executeToggle(labelId, version);
  };

  const handleCreateLabel = (e: React.FormEvent) => {
    e.preventDefault();
    executeCreate({
      boardId,
      cardId,
      title: titleValue,
      color: colorValue,
    });
  };

  const handleUpdateLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLabelId) return;

    executeUpdate({
      boardId,
      labelId: editingLabelId,
      title: titleValue,
      color: colorValue,
    });
  };

  const handleDeleteLabel = () => {
    if (!editingLabelId) return;

    executeDelete({
      boardId,
      labelId: editingLabelId,
    });
  };

  const handleOpenEdit = (label: Label) => {
    setEditingLabelId(label.id);
    setTitleValue(label.title);
    setColorValue(label.color);
    setScreen("edit");
  };

  const handleOpenCreate = () => {
    setTitleValue("");
    setColorValue("#0ea5e9");
    setScreen("create");
  };

  // Filter labels based on search
  const filteredLabels = useMemo(() => {
    if (!searchQuery) return boardLabels;
    return boardLabels.filter((label) =>
      label.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [boardLabels, searchQuery]);

  const activeLabelIds = useMemo(() => {
    return new Set(labels.map((l) => l.labelId));
  }, [labels]);

  const isLoading = isLoadingCreate || isLoadingUpdate || isLoadingDelete;

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange} modal={true}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-[280px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999] overflow-y-auto styled-scrollbar"
        style={{
          maxHeight: "min(400px, calc(var(--radix-popover-content-available-height, 90vh) - 20px))"
        }}
        sideOffset={6}
      >
        {/* --- SCREEN 1: SELECT LABELS --- */}
        {screen === "select" && (
          <div className="space-y-3">
            {/* Header */}
            <div className="relative pb-2 border-b border-neutral-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-700 mx-auto">Nhãn</span>
              <PopoverClose asChild>
                <button 
                  type="button" 
                  className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </PopoverClose>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Tìm nhãn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8.5 pl-8 pr-3 py-1.5 bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 hover:border-neutral-300 focus:border-violet-500 rounded-lg text-xs transition outline-hidden"
              />
            </div>

            {/* Labels List */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider pl-0.5">
                Nhãn
              </span>
              <div className="max-h-[220px] overflow-y-auto space-y-1.5 pr-1 styled-scrollbar">
                {filteredLabels.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4">Không tìm thấy nhãn</p>
                ) : (
                  filteredLabels.map((label) => {
                    const isChecked = activeLabelIds.has(label.id);
                    return (
                      <div key={label.id} className="flex items-center gap-x-2">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isLoading}
                          onChange={() => handleToggleLabel(label.id)}
                          className="h-4 w-4 rounded-sm border-neutral-300 accent-violet-600 cursor-pointer shadow-xs"
                        />
                        {/* Color Pill */}
                        <button
                          type="button"
                          onClick={() => handleToggleLabel(label.id)}
                          disabled={isLoading}
                          style={{ backgroundColor: label.color }}
                          className="flex-1 h-8 rounded-md px-3 text-left font-semibold text-neutral-900/90 text-xs truncate hover:opacity-85 active:opacity-75 transition-opacity shadow-xs border border-black/5 flex items-center justify-between cursor-pointer"
                        >
                          <span className="truncate">{label.title}</span>
                        </button>
                        {/* Edit Button */}
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleOpenEdit(label)}
                          className="p-1.5 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-md cursor-pointer shrink-0 transition-colors"
                          aria-label="Chỉnh sửa nhãn"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Create Button */}
            <div className="pt-1.5 border-t border-neutral-100">
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenCreate}
                disabled={isLoading}
                className="w-full h-8.5 rounded-lg border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300 text-xs font-semibold text-neutral-600 cursor-pointer transition-all"
              >
                Tạo nhãn mới
              </Button>
            </div>
          </div>
        )}

        {/* --- SCREEN 2: CREATE LABEL --- */}
        {screen === "create" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="relative pb-2 border-b border-neutral-100 flex items-center">
              <button 
                type="button"
                onClick={() => setScreen("select")}
                className="absolute left-0 text-neutral-400 hover:text-neutral-600 p-0.5 rounded-md cursor-pointer"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
              <span className="text-sm font-semibold text-neutral-700 mx-auto">Tạo nhãn mới</span>
              <PopoverClose asChild>
                <button 
                  type="button" 
                  className="absolute right-0 text-neutral-400 hover:text-neutral-600 rounded-sm cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </PopoverClose>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateLabel} className="space-y-4">
              {/* Preview Block */}
              <div className="bg-neutral-50 p-4 rounded-xl flex items-center justify-center border border-neutral-100">
                <div
                  style={{ backgroundColor: colorValue }}
                  className="w-full h-8 rounded-md flex items-center px-3 font-semibold text-neutral-900/90 text-xs shadow-xs border border-black/5 transition-colors"
                >
                  <span className="truncate">{titleValue || "\u00A0"}</span>
                </div>
              </div>

              {/* Title Input */}
              <div className="flex flex-col gap-y-1">
                <span className="text-[11px] font-bold text-neutral-500 uppercase pl-0.5">
                  Tiêu đề
                </span>
                <Input
                  id="title"
                  placeholder="Nhập tiêu đề nhãn..."
                  value={titleValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitleValue(e.target.value)}
                  disabled={isLoading}
                  className="h-9.5 px-3 rounded-lg border-neutral-200 text-xs"
                />
              </div>

              {/* Color Grid */}
              <div className="flex flex-col gap-y-1.5">
                <span className="text-[11px] font-bold text-neutral-500 uppercase pl-0.5">
                  Chọn một màu
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {LABEL_COLORS.map((color) => {
                    const isSelected = colorValue === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setColorValue(color)}
                        disabled={isLoading}
                        style={{ backgroundColor: color }}
                        className="h-8.5 rounded-md border border-black/5 hover:opacity-85 active:opacity-75 transition flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        {isSelected && <Check className="h-4 w-4 text-neutral-700/80" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Create Submit */}
              <div className="pt-1.5 flex gap-x-2 border-t border-neutral-100">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading}
                  className="flex-1 h-8.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Tạo mới
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* --- SCREEN 3: EDIT LABEL --- */}
        {screen === "edit" && (
          <div className="space-y-4">
            {/* Header */}
            <div className="relative pb-2 border-b border-neutral-100 flex items-center">
              <button 
                type="button"
                onClick={() => setScreen("select")}
                className="absolute left-0 text-neutral-400 hover:text-neutral-600 p-0.5 rounded-md cursor-pointer"
              >
                <ChevronLeft className="h-4.5 w-4.5" />
              </button>
              <span className="text-sm font-semibold text-neutral-700 mx-auto">Chỉnh sửa nhãn</span>
              <PopoverClose asChild>
                <button 
                  type="button" 
                  className="absolute right-0 text-neutral-400 hover:text-neutral-600 rounded-sm cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </PopoverClose>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateLabel} className="space-y-4">
              {/* Preview Block */}
              <div className="bg-neutral-50 p-4 rounded-xl flex items-center justify-center border border-neutral-100">
                <div
                  style={{ backgroundColor: colorValue }}
                  className="w-full h-8 rounded-md flex items-center px-3 font-semibold text-neutral-900/90 text-xs shadow-xs border border-black/5 transition-colors"
                >
                  <span className="truncate">{titleValue || "\u00A0"}</span>
                </div>
              </div>

              {/* Title Input */}
              <div className="flex flex-col gap-y-1">
                <span className="text-[11px] font-bold text-neutral-500 uppercase pl-0.5">
                  Tiêu đề
                </span>
                <Input
                  id="title"
                  placeholder="Nhập tiêu đề nhãn..."
                  value={titleValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitleValue(e.target.value)}
                  disabled={isLoading}
                  className="h-9.5 px-3 rounded-lg border-neutral-200 text-xs"
                />
              </div>

              {/* Color Grid */}
              <div className="flex flex-col gap-y-1.5">
                <span className="text-[11px] font-bold text-neutral-500 uppercase pl-0.5">
                  Chọn một màu
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {LABEL_COLORS.map((color) => {
                    const isSelected = colorValue === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setColorValue(color)}
                        disabled={isLoading}
                        style={{ backgroundColor: color }}
                        className="h-8.5 rounded-md border border-black/5 hover:opacity-85 active:opacity-75 transition flex items-center justify-center cursor-pointer shadow-xs"
                      >
                        {isSelected && <Check className="h-4 w-4 text-neutral-700/80" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Edit Submits */}
              <div className="pt-1.5 flex gap-x-2 border-t border-neutral-100">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading}
                  className="flex-1 h-8.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Lưu
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isLoading}
                  onClick={handleDeleteLabel}
                  className="h-8.5 rounded-lg bg-red-600 text-white hover:bg-red-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  Xóa
                </Button>
              </div>
            </form>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

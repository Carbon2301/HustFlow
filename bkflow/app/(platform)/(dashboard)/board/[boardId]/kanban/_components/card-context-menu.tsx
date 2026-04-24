"use client";

import { createPortal } from "react-dom";
import { Archive, Copy, ExternalLink, Pencil } from "lucide-react";

import type { CardContextMenuProps } from "../_types";

export const CardContextMenu = ({
  isOpen,
  canEdit,
  position,
  isLoadingArchive,
  onClose,
  onOpen,
  onRename,
  onCopy,
  onArchive,
}: CardContextMenuProps) => {
  if (!canEdit || !isOpen) {
    return null;
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[45] cursor-default"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      />
      <div
        data-context-menu="true"
        className="fixed z-[100] w-52 bg-white rounded-xl shadow-2xl border border-neutral-200 p-1.5 flex flex-col gap-y-1"
        style={{
          top: position.top,
          left: position.left,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={(event) => onOpen(event)}
          className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
        >
          <ExternalLink className="h-4 w-4 text-neutral-400" />
          Mở thẻ
        </button>
        <button
          onClick={onRename}
          className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
        >
          <Pencil className="h-4 w-4 text-neutral-400" />
          Đổi tên thẻ
        </button>
        <button
          onClick={onCopy}
          disabled={isLoadingArchive}
          className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
        >
          <Copy className="h-4 w-4 text-neutral-400" />
          Sao chép thẻ
        </button>
        <button
          onClick={onArchive}
          disabled={isLoadingArchive}
          className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
        >
          <Archive className="h-4 w-4 text-neutral-400" />
          {isLoadingArchive ? "Đang lưu trữ thẻ…" : "Lưu trữ thẻ"}
        </button>
      </div>
    </>,
    document.body,
  );
};

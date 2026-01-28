"use client";

import { AttachmentType, type CardAttachment } from "@prisma/client";
import { Download, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AttachmentActionsPopoverProps {
  item: CardAttachment;
  isDeleting: boolean;
  deletingId: string | null;
  onEdit: (id: string) => void;
  onDelete: (item: CardAttachment) => void;
}

export const AttachmentActionsPopover = ({
  item,
  isDeleting,
  deletingId,
  onEdit,
  onDelete,
}: AttachmentActionsPopoverProps) => {
  const isItemDeleting = isDeleting && deletingId === item.id;

  const onDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(item.url, "_blank");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-8 w-8 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
          aria-label="Tác vụ đính kèm"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="end">
        <div className="flex flex-col gap-y-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs font-normal cursor-pointer"
            asChild
          >
            <a href={item.url} target="_blank" rel="noreferrer">
              <Eye className="mr-2 h-3.5 w-3.5" />
              Mở
            </a>
          </Button>
          {item.type === AttachmentType.FILE && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs font-normal cursor-pointer"
              asChild
            >
              <a href={item.url} onClick={onDownload}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Tải xuống
              </a>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs font-normal cursor-pointer"
            onClick={() => onEdit(item.id)}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Đổi tên
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs font-normal text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
            disabled={isDeleting}
            onClick={() => onDelete(item)}
          >
            {isItemDeleting ? (
              <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-300 border-t-rose-500" />
            ) : (
              <Trash2 className="mr-2 h-3.5 w-3.5" />
            )}
            Xóa
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

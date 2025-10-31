"use client";

import { AttachmentType, CardAttachment } from "@prisma/client";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { createPortal } from "react-dom";
import {
  Download,
  ExternalLink,
  Eye,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Link2,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createCardAttachment } from "@/actions/create-card-attachment";
import { createCardFileAttachment } from "@/actions/create-card-file-attachment";
import { deleteCardAttachment } from "@/actions/delete-card-attachment";
import { updateCardAttachment } from "@/actions/update-card-attachment";
import { updateCardAttachmentOrder } from "@/actions/update-card-attachment-order";
import { FormInput } from "@/components/form/form-input";
import { FormSubmit } from "@/components/form/form-submit";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { UploadButton } from "@/lib/uploadthing";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";

interface AttachmentsProps {
  cardId: string;
  boardId: string;
  items: CardAttachment[];
}

function reorder<T>(list: T[], startIndex: number, endIndex: number) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
}

const compareAttachmentOrder = (a: CardAttachment, b: CardAttachment) => {
  if (a.type !== b.type) {
    return a.type === AttachmentType.LINK ? -1 : 1;
  }

  if (a.order !== b.order) {
    return a.order - b.order;
  }

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
};

const getExtension = (attachment: CardAttachment) => {
  const value = `${attachment.name} ${attachment.url}`.toLowerCase();
  const match = value.match(/\.([a-z0-9]+)(?:\?|#|\s|$)/);

  return match?.[1] ?? "";
};

const isImageAttachment = (attachment: CardAttachment) => {
  if (attachment.type !== AttachmentType.FILE) {
    return false;
  }

  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  const extension = getExtension(attachment);

  return (
    mimeType.startsWith("image/") ||
    ["avif", "gif", "jpeg", "jpg", "png", "webp"].includes(extension)
  );
};

const getFileKind = (attachment: CardAttachment) => {
  if (attachment.type === AttachmentType.LINK) {
    return "link";
  }

  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  const extension = getExtension(attachment);

  if (isImageAttachment(attachment)) {
    return "image";
  }

  if (mimeType.includes("pdf") || extension === "pdf") {
    return "pdf";
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    ["7z", "rar", "tar", "zip"].includes(extension)
  ) {
    return "archive";
  }

  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    ["doc", "docx"].includes(extension)
  ) {
    return "document";
  }

  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    ["csv", "xls", "xlsx"].includes(extension)
  ) {
    return "spreadsheet";
  }

  if (mimeType.startsWith("text/") || ["log", "md", "txt"].includes(extension)) {
    return "text";
  }

  return "file";
};

const getAttachmentIcon = (attachment: CardAttachment) => {
  const kind = getFileKind(attachment);

  switch (kind) {
    case "link":
      return Link2;
    case "image":
      return FileImage;
    case "pdf":
    case "text":
      return FileText;
    case "archive":
      return FileArchive;
    case "document":
      return FileType;
    case "spreadsheet":
      return FileSpreadsheet;
    default:
      return File;
  }
};

export const Attachments = ({
  cardId,
  boardId,
  items,
}: AttachmentsProps) => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const {
    execute: executeCreate,
    fieldErrors,
    isLoading: isCreating,
  } = useAction(createCardAttachment, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
      toast.success("Đã thêm liên kết đính kèm.", { id: "card-attachment-link" });
      setIsPopoverOpen(false);
    },
    onError: (error) => {
      toast.error(error, { id: "card-attachment-link" });
    },
  });

  const {
    execute: executeDelete,
    isLoading: isDeleting,
  } = useAction(deleteCardAttachment, {
    onSuccess: (attachment) => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
      toast.success(
        attachment.type === AttachmentType.FILE
          ? "Đã xóa file đính kèm."
          : "Đã xóa liên kết đính kèm.",
        { id: `card-attachment-delete-${attachment.id}` },
      );
      setDeletingId(null);
    },
    onError: (error) => {
      const toastId = deletingId
        ? `card-attachment-delete-${deletingId}`
        : "card-attachment-delete";

      toast.error(error, { id: toastId });
      setDeletingId(null);
    },
  });

  const {
    execute: executeUpdate,
    fieldErrors: updateFieldErrors,
    isLoading: isUpdating,
  } = useAction(updateCardAttachment, {
    onSuccess: (attachment) => {
      queryClient.setQueryData(
        ["card", cardId],
        (current: unknown) => {
          if (!current || typeof current !== "object") {
            return current;
          }

          const currentCard = current as { attachments?: CardAttachment[] };

          return {
            ...currentCard,
            attachments: (currentCard.attachments ?? []).map((item) =>
              item.id === attachment.id ? attachment : item,
            ),
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
      toast.success("Đã cập nhật đính kèm.", { id: `card-attachment-edit-${attachment.id}` });
      setEditingId(null);
    },
    onError: (error) => {
      const toastId = editingId
        ? `card-attachment-edit-${editingId}`
        : "card-attachment-edit";

      toast.error(error, { id: toastId });
    },
  });

  const {
    execute: executeCreateFile,
    isLoading: isSavingFile,
  } = useAction(createCardFileAttachment, {
    onSuccess: (attachment) => {
      queryClient.setQueryData(
        ["card", cardId],
        (current: unknown) => {
          if (!current || typeof current !== "object") {
            return current;
          }

          const currentCard = current as { attachments?: CardAttachment[] };

          return {
            ...currentCard,
            attachments: [
              attachment,
              ...(currentCard.attachments ?? []).filter((item) => item.id !== attachment.id),
            ],
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
      setUploadProgress(null);
      toast.success("Đã tải file đính kèm.", { id: "card-attachment-upload" });
      setIsPopoverOpen(false);
    },
    onError: (error) => {
      setUploadProgress(null);
      toast.error(error, { id: "card-attachment-upload" });
    },
  });

  const {
    execute: executeOrder,
    isLoading: isOrdering,
  } = useAction(updateCardAttachmentOrder, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    },
    onError: (error) => {
      toast.error(error);
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    },
  });

  const onSubmit = (formData: FormData) => {
    if (isCreating) {
      return;
    }

    const url = formData.get("url") as string;
    const name = formData.get("name") as string;

    toast.loading("Đang thêm liên kết...", { id: "card-attachment-link" });
    executeCreate({
      cardId,
      boardId,
      url,
      name,
    });
  };

  const onUpdate = (formData: FormData, item: CardAttachment) => {
    if (isUpdating) {
      return;
    }

    const name = formData.get("name") as string;
    const url = item.type === AttachmentType.LINK
      ? formData.get("url") as string
      : undefined;

    toast.loading("Đang cập nhật đính kèm...", { id: `card-attachment-edit-${item.id}` });
    executeUpdate({
      id: item.id,
      cardId,
      boardId,
      name,
      url,
    });
  };

  const onDelete = (item: CardAttachment) => {
    if (isDeleting || isUpdating || isOrdering) {
      return;
    }

    setDeletingId(item.id);
    setEditingId(null);
    toast.loading(
      item.type === AttachmentType.FILE
        ? "Đang xóa file đính kèm..."
        : "Đang xóa liên kết đính kèm...",
      { id: `card-attachment-delete-${item.id}` },
    );
    executeDelete({
      id: item.id,
      cardId,
      boardId,
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (destination.droppableId !== source.droppableId) {
      return;
    }

    if (destination.index === source.index) {
      return;
    }

    const type = source.droppableId === `attachments-${AttachmentType.LINK}`
      ? AttachmentType.LINK
      : AttachmentType.FILE;
    const sectionItems = items.filter((item) => item.type === type);
    const reorderedItems = reorder(sectionItems, source.index, destination.index)
      .map((item, index) => ({
        ...item,
        order: index,
      }));
    const reorderedById = new Map(reorderedItems.map((item) => [item.id, item]));

    queryClient.setQueryData(
      ["card", cardId],
      (current: unknown) => {
        if (!current || typeof current !== "object") {
          return current;
        }

        const currentCard = current as { attachments?: CardAttachment[] };

        return {
          ...currentCard,
          attachments: (currentCard.attachments ?? [])
            .map((item) => reorderedById.get(item.id) ?? item)
            .sort(compareAttachmentOrder),
        };
      },
    );

    executeOrder({
      boardId,
      cardId,
      type,
      items: reorderedItems.map((item) => ({
        id: item.id,
        order: item.order,
      })),
    });
  };

  const links = items.filter((item) => item.type === AttachmentType.LINK);
  const files = items.filter((item) => item.type === AttachmentType.FILE);

  const ItemActionsPopover = ({ item }: { item: CardAttachment }) => {
    const isItemDeleting = isDeleting && deletingId === item.id;

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
                <a href={item.url} download={item.name}>
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
              onClick={() => setEditingId(item.id)}
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

  return (
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Paperclip className="h-5 w-5 text-neutral-500" />
      </div>
      <div className="w-full min-w-0">
        <div className="mb-4 flex items-center justify-between gap-x-3">
          <p className="font-semibold text-base text-neutral-800">
            Các tập tin đính kèm
          </p>

          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-sm text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 px-3 cursor-pointer"
              >
                Thêm
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <span className="text-sm font-semibold text-neutral-700 flex-1 text-center">
                  Đính kèm
                </span>
                <PopoverClose asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </PopoverClose>
              </div>

              {/* Section 1: Attach file */}
              <div className="space-y-1 mb-4">
                <p className="text-sm font-medium text-neutral-700">
                  Đính kèm tệp từ máy tính của bạn
                </p>
                <div className="pt-2">
                  <UploadButton
                    endpoint="cardAttachmentUploader"
                    input={{ cardId, boardId }}
                    disabled={isSavingFile}
                    uploadProgressGranularity="coarse"
                    onUploadBegin={() => {
                      setUploadProgress(0);
                      toast.loading("Đang tải file lên...", { id: "card-attachment-upload" });
                    }}
                    onUploadProgress={(progress) => {
                      setUploadProgress(progress);
                    }}
                    onClientUploadComplete={(files) => {
                      const file = files[0];

                      if (!file) {
                        setUploadProgress(null);
                        toast.error("Không nhận được thông tin file đã tải.", { id: "card-attachment-upload" });
                        return;
                      }

                      toast.loading("Đang lưu file đính kèm...", { id: "card-attachment-upload" });
                      executeCreateFile({
                        cardId,
                        boardId,
                        name: file.name,
                        url: file.ufsUrl,
                        fileKey: file.key,
                        fileSize: file.size,
                        mimeType: file.type,
                      });
                    }}
                    onUploadError={(error) => {
                      setUploadProgress(null);
                      toast.error(error.message || "Tải file thất bại.", { id: "card-attachment-upload" });
                    }}
                    content={{
                      button({ ready, isUploading }) {
                        if (!ready) return "Đang chuẩn bị...";
                        return isUploading 
                          ? `Đang tải lên... ${uploadProgress !== null ? `${uploadProgress}%` : ""}`
                          : "Chọn tệp";
                      },
                      allowedContent() {
                        return null;
                      }
                    }}
                    appearance={{
                      container: "w-full",
                      button: "w-full h-9 rounded-lg border border-neutral-300 !bg-white !text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition-colors focus-within:ring-0 focus-within:ring-offset-0 after:hidden before:hidden cursor-pointer",
                      allowedContent: "hidden",
                    }}
                  />
                </div>
              </div>

              <div className="border-t my-3 border-neutral-200" />

              {/* Section 2: Add Link */}
              <form action={onSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700 flex items-center">
                    Dán liên kết <span className="text-rose-500 ml-0.5">*</span>
                  </label>
                  <FormInput
                    id="url"
                    type="text"
                    placeholder="Tìm các liên kết gần đây hoặc dán một..."
                    disabled={isCreating}
                    errors={fieldErrors}
                    className="h-9 rounded-lg bg-white border border-neutral-300"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-neutral-700">
                    Văn bản hiển thị (không bắt buộc)
                  </label>
                  <FormInput
                    id="name"
                    placeholder="Văn bản cần hiển thị"
                    disabled={isCreating}
                    errors={fieldErrors}
                    className="h-9 rounded-lg bg-white border border-neutral-300"
                  />
                  <p className="text-[11px] text-neutral-500 leading-normal">
                    Cung cấp tiêu đề hoặc mô tả cho liên kết này
                  </p>
                </div>

                <div className="flex justify-end gap-x-2 pt-1">
                  <PopoverClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-3 text-xs text-neutral-500 cursor-pointer"
                    >
                      Hủy
                    </Button>
                  </PopoverClose>
                  <FormSubmit
                    disabled={isCreating}
                    className="h-8 rounded-lg px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                  >
                    Thêm
                  </FormSubmit>
                </div>
              </form>
            </PopoverContent>
          </Popover>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-400">
            Chưa có đính kèm nào.
          </p>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
          <div className="space-y-4">
            {/* Links section */}
            {links.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Liên kết
                </p>
                <Droppable
                  droppableId={`attachments-${AttachmentType.LINK}`}
                  type={`attachment-${AttachmentType.LINK}`}
                >
                  {(dropProvided) => (
                    <ol
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className="space-y-2"
                    >
                  {links.map((item, index) => {
                    const Icon = getAttachmentIcon(item);
                    const isItemEditing = editingId === item.id;
                    const isItemUpdating = isUpdating && isItemEditing;

                    return (
                      <Draggable
                        key={item.id}
                        draggableId={item.id}
                        index={index}
                        isDragDisabled={isUpdating || isDeleting || isOrdering || Boolean(editingId)}
                      >
                        {(dragProvided, snapshot) => {
                          const child = (
                            <li
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              style={dragProvided.draggableProps.style}
                              className={`rounded-xl border border-neutral-200 bg-white p-3 hover:border-neutral-300 transition-colors select-none ${
                                snapshot.isDragging ? "shadow-lg cursor-grabbing" : "cursor-grab"
                              }`}
                            >
                              <div className="flex flex-col w-full">
                                <div className="flex items-center justify-between">
                                  <div 
                                    className="flex items-center gap-x-3 min-w-0 flex-1 cursor-pointer"
                                    onClick={(e) => {
                                      if ((e.target as HTMLElement).tagName !== "A") {
                                        window.open(item.url, "_blank");
                                      }
                                    }}
                                  >
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="truncate text-sm font-medium text-blue-600 hover:underline"
                                    >
                                      {item.name}
                                    </a>
                                  </div>
                                  <ItemActionsPopover item={item} />
                                </div>

                                {isItemEditing && (
                                  <form
                                    action={(formData) => onUpdate(formData, item)}
                                    className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FormInput
                                      id="url"
                                      type="text"
                                      label="URL"
                                      defaultValue={item.url}
                                      placeholder="https://example.com"
                                      disabled={isItemUpdating}
                                      errors={updateFieldErrors}
                                      className="h-9 rounded-lg bg-white"
                                    />
                                    <FormInput
                                      id="name"
                                      label="Tên hiển thị"
                                      defaultValue={item.name}
                                      placeholder="Tùy chọn"
                                      disabled={isItemUpdating}
                                      errors={updateFieldErrors}
                                      className="h-9 rounded-lg bg-white"
                                    />
                                    <div className="flex items-center gap-x-2">
                                      <FormSubmit
                                        disabled={isItemUpdating}
                                        className="h-8 rounded-lg px-3 text-xs"
                                      >
                                        {isItemUpdating ? "Đang lưu..." : "Lưu"}
                                      </FormSubmit>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-xs text-neutral-500"
                                        disabled={isItemUpdating}
                                        onClick={() => setEditingId(null)}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        Hủy
                                      </Button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            </li>
                          );

                          if (snapshot.isDragging) {
                            return createPortal(child, document.body);
                          }

                          return child;
                        }}
                      </Draggable>
                    );
                  })}
                      {dropProvided.placeholder}
                    </ol>
                  )}
                </Droppable>
              </div>
            )}

            {/* Files section */}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  Tệp
                </p>
                <Droppable
                  droppableId={`attachments-${AttachmentType.FILE}`}
                  type={`attachment-${AttachmentType.FILE}`}
                >
                  {(dropProvided) => (
                    <ol
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                      className="space-y-2"
                    >
                  {files.map((item, index) => {
                    const Icon = getAttachmentIcon(item);
                    const isImage = isImageAttachment(item);
                    const isItemEditing = editingId === item.id;
                    const isItemUpdating = isUpdating && isItemEditing;
                    const timeLabel = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi });

                    return (
                      <Draggable
                        key={item.id}
                        draggableId={item.id}
                        index={index}
                        isDragDisabled={isUpdating || isDeleting || isOrdering || Boolean(editingId)}
                      >
                        {(dragProvided, snapshot) => {
                          const child = (
                            <li
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              style={dragProvided.draggableProps.style}
                              className={`rounded-xl border border-neutral-200 bg-neutral-50 p-3 hover:border-neutral-300 hover:bg-neutral-100/50 transition-colors select-none ${
                                snapshot.isDragging ? "shadow-lg cursor-grabbing" : "cursor-grab"
                              }`}
                            >
                              <div className="flex flex-col w-full">
                                <div className="flex items-start gap-x-3">
                                  <div 
                                    className="flex items-start gap-x-3 min-w-0 flex-1 cursor-pointer"
                                    onClick={(e) => {
                                      if ((e.target as HTMLElement).tagName !== "A") {
                                        window.open(item.url, "_blank");
                                      }
                                    }}
                                  >
                                    <a
                                      href={item.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="relative flex h-14 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white text-neutral-500"
                                      aria-label="Mở đính kèm"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {isImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={item.url}
                                          alt={item.name}
                                          className="h-full w-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : getFileKind(item) === "pdf" ? (
                                        <div className="h-full w-full bg-neutral-100 flex items-center justify-center font-bold text-xs text-neutral-500 uppercase">
                                          PDF
                                        </div>
                                      ) : (
                                        <div className="h-full w-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                                          <Icon className="h-6 w-6" />
                                        </div>
                                      )}
                                    </a>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-x-2">
                                        <div className="min-w-0">
                                          <p className="truncate font-medium text-neutral-800 text-sm">
                                            {item.name}
                                          </p>
                                          <p className="mt-0.5 text-xs text-neutral-400">
                                            {`Đã thêm ${timeLabel}`}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-x-1.5 flex-shrink-0">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="h-8 w-8 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                            asChild
                                          >
                                            <a
                                              href={item.url}
                                              target="_blank"
                                              rel="noreferrer"
                                              aria-label="Mở liên kết"
                                            >
                                              <ExternalLink className="h-4 w-4" />
                                            </a>
                                          </Button>
                                          <ItemActionsPopover item={item} />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {isItemEditing && (
                                  <form
                                    action={(formData) => onUpdate(formData, item)}
                                    className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-white p-3"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <FormInput
                                      id="name"
                                      label="Tên file"
                                      defaultValue={item.name}
                                      placeholder="Tên file"
                                      disabled={isItemUpdating}
                                      errors={updateFieldErrors}
                                      className="h-9 rounded-lg bg-white"
                                    />
                                    <div className="flex items-center gap-x-2">
                                      <FormSubmit
                                        disabled={isItemUpdating}
                                        className="h-8 rounded-lg px-3 text-xs"
                                      >
                                        {isItemUpdating ? "Đang lưu..." : "Lưu"}
                                      </FormSubmit>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 text-xs text-neutral-500"
                                        disabled={isItemUpdating}
                                        onClick={() => setEditingId(null)}
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        Hủy
                                      </Button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            </li>
                          );

                          if (snapshot.isDragging) {
                            return createPortal(child, document.body);
                          }

                          return child;
                        }}
                      </Draggable>
                    );
                  })}
                      {dropProvided.placeholder}
                    </ol>
                  )}
                </Droppable>
              </div>
            )}
          </div>
          </DragDropContext>
        )}
      </div>
    </div>
  );
};

"use client";

import { AttachmentType, type CardAttachment } from "@prisma/client";
import { Draggable } from "@hello-pangea/dnd";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { createPortal } from "react-dom";

import type { InputType as UpdateCardAttachmentInput } from "@/actions/attachments/update-card-attachment/types";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/hooks/use-has-mounted";
import type { FieldErrors } from "@/lib/create-safe-action";

import { AttachmentActionsPopover } from "./attachment-actions-popover";
import { AttachmentEditForm } from "./attachment-edit-form";
import {
  getAttachmentIcon,
  getFileKind,
  isImageAttachment,
} from "./attachment-utils";

interface AttachmentItemProps {
  item: CardAttachment;
  index: number;
  isDragDisabled: boolean;
  isEditing: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  deletingId: string | null;
  updateFieldErrors: FieldErrors<UpdateCardAttachmentInput> | undefined;
  onUpdate: (formData: FormData, item: CardAttachment) => void;
  onCancelEdit: () => void;
  onEdit: (id: string) => void;
  onDelete: (item: CardAttachment) => void;
  canEdit?: boolean;
}

export const AttachmentItem = ({
  item,
  index,
  isDragDisabled,
  isEditing,
  isUpdating,
  isDeleting,
  deletingId,
  updateFieldErrors,
  onUpdate,
  onCancelEdit,
  onEdit,
  onDelete,
  canEdit = true,
}: AttachmentItemProps) => {
  const hasMounted = useHasMounted();
  const Icon = getAttachmentIcon(item);

  if (item.type === AttachmentType.LINK) {
    return (
      <Draggable
        key={item.id}
        draggableId={item.id}
        index={index}
        isDragDisabled={isDragDisabled}
      >
        {(dragProvided, snapshot) => {
          const child = (
            <li
              ref={dragProvided.innerRef}
              {...dragProvided.draggableProps}
              {...(canEdit ? dragProvided.dragHandleProps : {})}
              style={dragProvided.draggableProps.style}
              className={`rounded-xl border border-neutral-200 bg-white p-3 hover:border-neutral-300 transition-colors select-none ${
                snapshot.isDragging ? "shadow-lg cursor-grabbing" : canEdit ? "cursor-grab" : "cursor-default"
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
                  {canEdit && (
                    <AttachmentActionsPopover
                      item={item}
                      isDeleting={isDeleting}
                      deletingId={deletingId}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  )}
                </div>

                {isEditing && (
                  <AttachmentEditForm
                    item={item}
                    isUpdating={isUpdating}
                    fieldErrors={updateFieldErrors}
                    onUpdate={onUpdate}
                    onCancel={onCancelEdit}
                  />
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
  }

  const isImage = isImageAttachment(item);
  const timeLabel = hasMounted
    ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi })
    : "";

  return (
    <Draggable
      key={item.id}
      draggableId={item.id}
      index={index}
      isDragDisabled={isDragDisabled}
    >
      {(dragProvided, snapshot) => {
        const child = (
          <li
            ref={dragProvided.innerRef}
            {...dragProvided.draggableProps}
            {...(canEdit ? dragProvided.dragHandleProps : {})}
            style={dragProvided.draggableProps.style}
            className={`rounded-xl border border-neutral-200 bg-neutral-50 p-3 hover:border-neutral-300 hover:bg-neutral-100/50 transition-colors select-none ${
              snapshot.isDragging ? "shadow-lg cursor-grabbing" : canEdit ? "cursor-grab" : "cursor-default"
            }`}
          >
            <div className="flex flex-col w-full">
              <div className="flex items-start gap-x-3 w-full">
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
                    <p className="truncate font-medium text-neutral-800 text-sm">
                      {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {timeLabel ? `Đã thêm ${timeLabel}` : "Đã thêm"}
                    </p>
                  </div>
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
                  {canEdit && (
                    <AttachmentActionsPopover
                      item={item}
                      isDeleting={isDeleting}
                      deletingId={deletingId}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  )}
                </div>
              </div>

              {isEditing && (
                <AttachmentEditForm
                  item={item}
                  isUpdating={isUpdating}
                  fieldErrors={updateFieldErrors}
                  onUpdate={onUpdate}
                  onCancel={onCancelEdit}
                />
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
};

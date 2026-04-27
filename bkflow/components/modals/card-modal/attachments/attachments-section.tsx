"use client";

import { AttachmentType, CardAttachment } from "@prisma/client";
import {
  DragDropContext,
  Droppable,
} from "@hello-pangea/dnd";
import {
  Paperclip,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { AttachmentAddPopover } from "./attachment-add-popover";
import { AttachmentItem } from "./attachment-item";
import { useAttachmentActions } from "./use-attachment-actions";

interface AttachmentsProps {
  cardId: string;
  boardId: string;
  items: CardAttachment[];
  canEdit?: boolean;
}

export const AttachmentsSection = ({
  cardId,
  boardId,
  items,
  canEdit = true,
}: AttachmentsProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    updateFieldErrors,
    isDeleting,
    isUpdating,
    isOrdering,
    onUpdate,
    onDelete,
    onDragEnd,
  } = useAttachmentActions({
    cardId,
    boardId,
    items,
    editingId,
    deletingId,
    setEditingId,
    setDeletingId,
  });

  const links = items.filter((item) => item.type === AttachmentType.LINK);
  const files = items.filter((item) => item.type === AttachmentType.FILE);

  if (items.length === 0) {
    return null;
  }

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

          {canEdit && (
            <AttachmentAddPopover
              cardId={cardId}
              boardId={boardId}
              side="bottom"
              align="end"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-sm text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 px-3 cursor-pointer"
              >
                Thêm
              </Button>
            </AttachmentAddPopover>
          )}
        </div>

        <DragDropContext onDragEnd={canEdit ? onDragEnd : () => undefined}>
          <div className="space-y-4">
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
                        const isItemEditing = editingId === item.id;
                        const isItemUpdating = isUpdating && isItemEditing;

                        return (
                          <AttachmentItem
                            key={item.id}
                            item={item}
                            index={index}
                            isDragDisabled={!canEdit || isUpdating || isDeleting || isOrdering || Boolean(editingId)}
                            isEditing={canEdit && isItemEditing}
                            isUpdating={isItemUpdating}
                            isDeleting={isDeleting}
                            deletingId={deletingId}
                            updateFieldErrors={updateFieldErrors}
                            onUpdate={onUpdate}
                            onCancelEdit={() => setEditingId(null)}
                            onEdit={setEditingId}
                            onDelete={onDelete}
                            canEdit={canEdit}
                          />
                        );
                      })}
                      {dropProvided.placeholder}
                    </ol>
                  )}
                </Droppable>
              </div>
            )}

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
                        const isItemEditing = editingId === item.id;
                        const isItemUpdating = isUpdating && isItemEditing;

                        return (
                          <AttachmentItem
                            key={item.id}
                            item={item}
                            index={index}
                            isDragDisabled={!canEdit || isUpdating || isDeleting || isOrdering || Boolean(editingId)}
                            isEditing={canEdit && isItemEditing}
                            isUpdating={isItemUpdating}
                            isDeleting={isDeleting}
                            deletingId={deletingId}
                            updateFieldErrors={updateFieldErrors}
                            onUpdate={onUpdate}
                            onCancelEdit={() => setEditingId(null)}
                            onEdit={setEditingId}
                            onDelete={onDelete}
                            canEdit={canEdit}
                          />
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
      </div>
    </div>
  );
};

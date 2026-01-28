"use client";

import { AttachmentType, type CardAttachment } from "@prisma/client";
import type { DropResult } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { deleteCardAttachment } from "@/actions/delete-card-attachment";
import { updateCardAttachment } from "@/actions/update-card-attachment";
import { updateCardAttachmentOrder } from "@/actions/update-card-attachment-order";
import { useAction } from "@/hooks/use-action";

import { compareAttachmentOrder, reorder } from "./attachment-utils";

interface UseAttachmentActionsParams {
  cardId: string;
  boardId: string;
  items: CardAttachment[];
  editingId: string | null;
  deletingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  setDeletingId: Dispatch<SetStateAction<string | null>>;
}

export const useAttachmentActions = ({
  cardId,
  boardId,
  items,
  editingId,
  deletingId,
  setEditingId,
  setDeletingId,
}: UseAttachmentActionsParams) => {
  const queryClient = useQueryClient();

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

  return {
    updateFieldErrors,
    isDeleting,
    isUpdating,
    isOrdering,
    onUpdate,
    onDelete,
    onDragEnd,
  };
};

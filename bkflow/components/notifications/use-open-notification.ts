"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { NotificationItem } from "@/components/notifications/types";
import { useCardModal } from "@/hooks/use-card-modal";

const showCardOpenError = (status?: number) => {
  if (status === 404) {
    toast.error("Thẻ không tồn tại hoặc đã bị xóa.");
    return;
  }

  if (status === 403) {
    toast.error("Bạn không có quyền truy cập thẻ này.");
    return;
  }

  toast.error("Có lỗi xảy ra khi tải dữ liệu thẻ.");
};

const showBoardOpenError = (status?: number) => {
  if (status === 404) {
    toast.error("Bảng không tồn tại hoặc đã bị xóa.");
    return;
  }

  if (status === 403) {
    toast.error("Bạn không có quyền truy cập bảng này.");
    return;
  }

  toast.error("Có lỗi xảy ra khi tải dữ liệu bảng.");
};

export const useOpenNotification = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const openCardModal = useCardModal((state) => state.onOpen);

  return useCallback(
    async (notification: NotificationItem) => {
      if (notification.cardId) {
        try {
          const response = await fetch(`/api/cards/${notification.cardId}`);

          if (!response.ok) {
            showCardOpenError(response.status);
            return;
          }

          const data = await response.json();
          const boardId = data?.list?.boardId || notification.boardId;

          queryClient.setQueryData(["card", notification.cardId], data);

          if (boardId) {
            router.push(`/board/${boardId}?cardId=${notification.cardId}`);
            return;
          }

          openCardModal(notification.cardId);
        } catch {
          showCardOpenError();
        }

        return;
      }

      if (notification.boardId) {
        try {
          const response = await fetch(`/api/boards/${notification.boardId}`);

          if (!response.ok) {
            showBoardOpenError(response.status);
            return;
          }

          router.push(`/board/${notification.boardId}`);
        } catch {
          showBoardOpenError();
        }
      }
    },
    [openCardModal, queryClient, router],
  );
};

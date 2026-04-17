"use client";

import { useCallback, useRef } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "sonner";

import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";

import type {
  BoardCalendarAccessPayload,
  BoardCalendarRealtimePayload,
} from "../_components/board-calendar/types";

type CalendarCardModal = {
  onClose: () => void;
};

type UseCalendarRealtimeOptions = {
  boardId: string;
  currentUserId: string;
  router: AppRouterInstance;
  cardModal: CalendarCardModal;
  invalidateBoardCalendar: () => void;
};

export const useCalendarRealtime = ({
  boardId,
  currentUserId,
  router,
  cardModal,
  invalidateBoardCalendar,
}: UseCalendarRealtimeOptions) => {
  const processedRealtimeEventIdsRef = useRef<Set<string>>(new Set());
  const realtimeChannelName = realtimeChannels.board(boardId);
  const realtimeEnabled = isRealtimeClientConfigured();

  const processRealtimeEvent = useCallback((
    payload: BoardCalendarRealtimePayload,
    options: { skipOwnEcho?: boolean } = {},
  ) => {
    if (payload.boardId !== boardId) {
      return false;
    }

    if (processedRealtimeEventIdsRef.current.has(payload.eventId)) {
      return false;
    }

    processedRealtimeEventIdsRef.current.add(payload.eventId);

    return options.skipOwnEcho === false || payload.actorUserId !== currentUserId;
  }, [boardId, currentUserId]);

  const handleCalendarRealtime = useCallback((payload: BoardCalendarRealtimePayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    invalidateBoardCalendar();
  }, [invalidateBoardCalendar, processRealtimeEvent]);

  const handleCalendarRealtimeWithRefresh = useCallback((payload: BoardCalendarRealtimePayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    invalidateBoardCalendar();
    router.refresh();
  }, [invalidateBoardCalendar, processRealtimeEvent, router]);

  const handleBoardDeletedRealtime = useCallback((payload: BoardCalendarAccessPayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    toast.error("Bảng này đã bị xóa.");
    cardModal.onClose();
    router.push(`/organization/${payload.orgId}`);
  }, [cardModal, processRealtimeEvent, router]);

  const handleAccessRevokedRealtime = useCallback((payload: BoardCalendarAccessPayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    if (payload.targetUserId === currentUserId) {
      toast.error("Bạn không còn quyền truy cập bảng này.");
      cardModal.onClose();
      router.push(`/organization/${payload.orgId}`);
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    invalidateBoardCalendar();
    router.refresh();
  }, [cardModal, currentUserId, invalidateBoardCalendar, processRealtimeEvent, router]);

  return {
    realtimeChannelName,
    realtimeEnabled,
    handleCalendarRealtime,
    handleCalendarRealtimeWithRefresh,
    handleBoardDeletedRealtime,
    handleAccessRevokedRealtime,
  };
};

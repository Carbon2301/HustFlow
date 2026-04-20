"use client";

import {
  type RefObject,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "sonner";

import type { RealtimeQueryInvalidation } from "@/lib/realtime/types";

import type {
  TimelineDateOverride,
  TimelineInteraction,
} from "../_types";

const getRealtimePayloadField = <TValue,>(
  payload: unknown,
  field: string,
) => {
  if (!payload || typeof payload !== "object" || !(field in payload)) {
    return undefined;
  }

  return (payload as Record<string, TValue>)[field];
};

const getRealtimePayloadEventId = (payload: unknown) =>
  getRealtimePayloadField<string>(payload, "eventId");

const getRealtimePayloadCardId = (payload: unknown) =>
  getRealtimePayloadField<string>(payload, "cardId");

const getRealtimePayloadTargetUserId = (payload: unknown) =>
  getRealtimePayloadField<string>(payload, "targetUserId");

const getRealtimePayloadInvalidations = (payload: unknown) =>
  getRealtimePayloadField<RealtimeQueryInvalidation[]>(payload, "invalidate") ?? [];

type UseTimelineRealtimeInput = {
  currentUserId: string;
  router: AppRouterInstance;
  queryClient: QueryClient;
  interaction: TimelineInteraction | null;
  interactionRef: RefObject<TimelineInteraction | null>;
  pendingUpdateCardIdRef: RefObject<string | null>;
  setUpdatingCardId: Dispatch<SetStateAction<string | null>>;
  setDateOverrides: Dispatch<SetStateAction<Record<string, TimelineDateOverride>>>;
};

export const useTimelineRealtime = ({
  currentUserId,
  router,
  queryClient,
  interaction,
  interactionRef,
  pendingUpdateCardIdRef,
  setUpdatingCardId,
  setDateOverrides,
}: UseTimelineRealtimeInput) => {
  const processedEventIdsRef = useRef(new Set<string>());
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const pendingRealtimeRefreshRef = useRef(false);
  const markRealtimeEventProcessed = useCallback((payload: unknown) => {
    const eventId = getRealtimePayloadEventId(payload);

    if (!eventId) {
      return true;
    }

    const processedEventIds = processedEventIdsRef.current;

    if (processedEventIds.has(eventId)) {
      return false;
    }

    if (processedEventIds.size > 200) {
      processedEventIds.clear();
    }

    processedEventIds.add(eventId);
    return true;
  }, []);

  const invalidateRealtimeQueries = useCallback((payload: unknown) => {
    getRealtimePayloadInvalidations(payload).forEach(({ queryKey }) => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, [queryClient]);

  const clearRealtimeOptimisticState = useCallback((payload: unknown) => {
    const cardId = getRealtimePayloadCardId(payload);

    if (!cardId) {
      return;
    }

    if (pendingUpdateCardIdRef.current === cardId) {
      pendingUpdateCardIdRef.current = null;
      setUpdatingCardId(null);
    }

    setDateOverrides((current) => {
      if (!current[cardId]) {
        return current;
      }

      const next = { ...current };
      delete next[cardId];
      return next;
    });
  }, [pendingUpdateCardIdRef, setDateOverrides, setUpdatingCardId]);

  const scheduleTimelineRefresh = useCallback((
    payload?: unknown,
    options: { force?: boolean } = {},
  ) => {
    if (payload) {
      invalidateRealtimeQueries(payload);
      clearRealtimeOptimisticState(payload);
    }

    if (!options.force && interactionRef.current) {
      pendingRealtimeRefreshRef.current = true;
      return;
    }

    if (realtimeRefreshTimerRef.current !== null) {
      return;
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      router.refresh();
    }, 150);
  }, [clearRealtimeOptimisticState, interactionRef, invalidateRealtimeQueries, router]);

  const handleTimelineRefresh = useCallback((payload: unknown) => {
    if (!markRealtimeEventProcessed(payload)) {
      return;
    }

    scheduleTimelineRefresh(payload);
  }, [markRealtimeEventProcessed, scheduleTimelineRefresh]);

  const handleTimelineAccessRevoked = useCallback((payload: unknown) => {
    if (!markRealtimeEventProcessed(payload)) {
      return;
    }

    const targetUserId = getRealtimePayloadTargetUserId(payload);

    if (targetUserId === currentUserId) {
      toast.error("Quyền truy cập bảng đã thay đổi.");
      scheduleTimelineRefresh(payload, { force: true });
      return;
    }

    scheduleTimelineRefresh(payload);
  }, [currentUserId, markRealtimeEventProcessed, scheduleTimelineRefresh]);

  const handleTimelineBoardDeleted = useCallback((payload: unknown) => {
    if (!markRealtimeEventProcessed(payload)) {
      return;
    }

    toast.error("Bảng này không còn khả dụng.");
    scheduleTimelineRefresh(payload, { force: true });
  }, [markRealtimeEventProcessed, scheduleTimelineRefresh]);

  useEffect(() => () => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (interaction || !pendingRealtimeRefreshRef.current) {
      return;
    }

    pendingRealtimeRefreshRef.current = false;

    if (realtimeRefreshTimerRef.current !== null) {
      return;
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      router.refresh();
    }, 150);
  }, [interaction, router]);

  return {
    handleTimelineRefresh,
    handleTimelineAccessRevoked,
    handleTimelineBoardDeleted,
  };
};

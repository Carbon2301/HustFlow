"use client";

import { useRef, useState } from "react";
import { BoardMemberRole } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { CalendarX2 } from "lucide-react";
import { toast } from "sonner";
import { toPng } from "html-to-image";

import { updateCard } from "@/actions/cards/update-card";
import { useAction } from "@/hooks/use-action";
import { useCardModal } from "@/hooks/use-card-modal";
import { buildBoardExportFileName } from "@/lib/exports/filename";
import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";
import type {
  BoardTimelineBoardMember,
  BoardTimelineList,
} from "@/types";

import { EmptyTimeline } from "./empty-timeline";
import { BoardTimelineRealtimeSubscriptions } from "./realtime-subscriptions";
import { TimelineGrid } from "./timeline-grid";
import { TimelineToolbar } from "./timeline-toolbar";
import { UnscheduledDrawer } from "./unscheduled-drawer";
import { useTimelineInteraction } from "../_hooks/use-timeline-interaction";
import { useTimelineRealtime } from "../_hooks/use-timeline-realtime";
import { useTimelineState } from "../_hooks/use-timeline-state";
import { GANTT_MAX_HEIGHT, formatTimelineRangeEndpoint } from "../_lib/layout-utils";

const waitForAnimationFrames = async (count: number) => {
  for (let index = 0; index < count; index += 1) {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  }
};

type BoardTimelineViewProps = {
  boardId: string;
  boardTitle: string;
  lists: BoardTimelineList[];
  boardMembers: BoardTimelineBoardMember[];
  currentUserId: string;
  currentBoardMemberId: string;
  currentMemberRole: BoardMemberRole;
};

export const BoardTimelineView = ({
  boardId,
  boardTitle,
  lists,
  currentUserId,
  currentMemberRole,
}: BoardTimelineViewProps) => {
  const [updatingCardId, setUpdatingCardId] = useState<string | null>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);
  const pendingUpdateCardIdRef = useRef<string | null>(null);
  const ganttScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const ganttExportContentRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const cardModal = useCardModal();
  const canEditTimeline = currentMemberRole !== BoardMemberRole.VIEWER;
  const realtimeChannelName = realtimeChannels.board(boardId);
  const realtimeEnabled = isRealtimeClientConfigured();
  const {
    zoom,
    setZoom,
    setDateOverrides,
    removeDateOverride,
    isUnscheduledPanelOpen,
    setIsUnscheduledPanelOpen,
    derived,
  } = useTimelineState(lists);
  const { execute: executeUpdateCard } = useAction(updateCard, {
    onSuccess: (data) => {
      setDateOverrides((current) => {
        return {
          ...current,
          [data.id]: {
            startDate: data.startDate ? data.startDate.toISOString() : null,
            dueDate: data.dueDate ? data.dueDate.toISOString() : null,
          },
        };
      });
      setUpdatingCardId(null);
      pendingUpdateCardIdRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
    },
    onError: (error) => {
      const cardId = pendingUpdateCardIdRef.current;

      if (cardId) {
        setDateOverrides((current) => {
          const next = { ...current };
          delete next[cardId];
          return next;
        });
      }

      setUpdatingCardId(null);
      pendingUpdateCardIdRef.current = null;
      toast.error(error);
    },
  });
  const {
    interaction,
    interactionRef,
    handleBarPointerDown,
    shouldSuppressCardOpen,
  } = useTimelineInteraction({
    boardId,
    zoom,
    canEditTimeline,
    updatingCardId,
    setUpdatingCardId,
    setDateOverrides,
    removeDateOverride,
    executeUpdateCard,
    pendingUpdateCardIdRef,
  });
  const {
    handleTimelineRefresh,
    handleTimelineAccessRevoked,
    handleTimelineBoardDeleted,
  } = useTimelineRealtime({
    currentUserId,
    router,
    queryClient,
    interaction,
    interactionRef,
    pendingUpdateCardIdRef,
    setUpdatingCardId,
    setDateOverrides,
  });
  const openCard = (cardId: string) => {
    if (shouldSuppressCardOpen(cardId)) {
      return;
    }

    cardModal.onOpen(cardId);
  };
  const handleExportPng = async () => {
    const exportNode = ganttExportContentRef.current;

    if (!exportNode || !hasScheduledCards) {
      toast.error("Không có timeline để xuất.");
      return;
    }

    setIsExportingPng(true);

    try {
      await waitForAnimationFrames(2);

      const width = exportNode.scrollWidth;
      const height = exportNode.scrollHeight;

      if (width * height > 8_000_000) {
        toast.info("Timeline lớn, ảnh có thể mất vài giây để xuất.");
      }

      const dataUrl = await toPng(exportNode, {
        cacheBust: true,
        pixelRatio: 2,
        width,
        height,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          background: "#ffffff",
        },
      });
      const anchor = document.createElement("a");

      anchor.href = dataUrl;
      anchor.download = buildBoardExportFileName(boardTitle, "timeline", "png");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      toast.success("Đã xuất Timeline PNG.");
    } catch (error) {
      console.error("[TIMELINE_EXPORT_PNG_ERROR]", error);
      toast.error("Không thể xuất Timeline PNG. Vui lòng thử lại.");
    } finally {
      setIsExportingPng(false);
    }
  };
  const hasCards = derived.stats.totalCards > 0;
  const hasScheduledCards = derived.scheduledCards.length > 0;

  return (
    <>
      <BoardTimelineRealtimeSubscriptions
        channelName={realtimeChannelName}
        enabled={realtimeEnabled}
        onRefresh={handleTimelineRefresh}
        onAccessRevoked={handleTimelineAccessRevoked}
        onBoardDeleted={handleTimelineBoardDeleted}
      />
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-950 shadow-sm">
        <div className="flex shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-neutral-950">Tiến độ</h1>
            <p className="text-xs text-neutral-500">
              {formatTimelineRangeEndpoint(derived.timelineStart)} - {formatTimelineRangeEndpoint(derived.timelineEnd)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUnscheduledPanelOpen((value) => !value)}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-x-1.5 rounded-lg border px-3 text-xs font-semibold transition",
                isUnscheduledPanelOpen
                  ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950",
              )}
            >
              <CalendarX2 className="h-3.5 w-3.5 shrink-0" />
              <span>Chưa lên lịch ({derived.stats.unscheduledCards})</span>
            </button>
            <TimelineToolbar
              zoom={zoom}
              onZoomChange={setZoom}
              onExportPng={handleExportPng}
              isExporting={isExportingPng}
              canExport={hasScheduledCards}
            />
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden p-3">
          {!hasScheduledCards ? (
            <EmptyTimeline hasCards={hasCards} />
          ) : (
            <div
              ref={ganttScrollContainerRef}
              className="h-full overflow-auto rounded-lg border border-neutral-200 bg-white"
              style={{ maxHeight: GANTT_MAX_HEIGHT }}
            >
              <div ref={ganttExportContentRef} className="min-w-max bg-white">
                <TimelineGrid
                  rows={derived.scheduledCards}
                  units={derived.units}
                  zoom={zoom}
                  onOpenCard={openCard}
                  onBarPointerDown={handleBarPointerDown}
                  canEdit={canEditTimeline}
                  updatingCardId={updatingCardId}
                  activeInteraction={interaction}
                  scrollContainerRef={ganttScrollContainerRef}
                  isExporting={isExportingPng}
                />
              </div>
            </div>
          )}

          <UnscheduledDrawer
            cards={derived.unscheduledCards}
            isOpen={isUnscheduledPanelOpen}
            onClose={() => setIsUnscheduledPanelOpen(false)}
            onOpenCard={openCard}
          />
        </div>
      </section>
    </>
  );
};

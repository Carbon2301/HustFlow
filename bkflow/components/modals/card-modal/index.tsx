"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { CardCommentWithReplies, CardWithList } from "@/types";
import { fetcher } from "@/lib/fetcher";
import { AuditLog, BoardMemberRole } from "@prisma/client";
import { useCardModal } from "@/hooks/use-card-modal";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Header } from "./header";
import { MetadataSection as Metadata } from "./metadata/metadata-section";
import { Description } from "./description";
import { Activity } from "./activity";
import { CommentsSection as Comments } from "./comments/comments-section";
import { CardRealtimeSync } from "./card-realtime-sync";
import { ChecklistsSection as Checklists } from "./checklists/checklists-section";
import { AttachmentsSection as Attachments } from "./attachments/attachments-section";
import { AiCardQualityAssistant } from "./ai/ai-card-quality-assistant";
import { DependenciesSection as CardDependencies } from "./dependencies/dependencies-section";

const toTimestampString = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const CardModalMainContent = ({
  cardData,
  canEdit,
}: {
  cardData: CardWithList;
  canEdit: boolean;
}) => {
  const [descriptionBaseUpdatedAt, setDescriptionBaseUpdatedAt] = useState(
    () => toTimestampString(cardData.descriptionUpdatedAt),
  );
  const getDescriptionBaseUpdatedAt = useCallback(
    () => descriptionBaseUpdatedAt,
    [descriptionBaseUpdatedAt],
  );

  return (
    <>
      <Description
        data={cardData}
        canEdit={canEdit}
        getDescriptionBaseUpdatedAt={getDescriptionBaseUpdatedAt}
        onDescriptionBaseUpdatedAtChange={setDescriptionBaseUpdatedAt}
      />
      <CardDependencies data={cardData} canEdit={canEdit} />
      {canEdit && (
        <AiCardQualityAssistant
          cardId={cardData.id}
          boardId={cardData.list.boardId}
          checklists={cardData.checklists || []}
        />
      )}
      {(cardData.attachments ?? []).length > 0 && (
        <Attachments
          cardId={cardData.id}
          boardId={cardData.list.boardId}
          items={cardData.attachments ?? []}
          canEdit={canEdit}
        />
      )}
      <Checklists
        cardId={cardData.id}
        boardId={cardData.list.boardId}
        cardDueDate={cardData.dueDate}
        boardMembers={cardData.boardMembers || []}
        checklists={cardData.checklists || []}
        canEdit={canEdit}
      />
    </>
  );
};

export const CardModal = () => {
  const id = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);

  const { data: cardData, error, isError } = useQuery<CardWithList>({
    queryKey: ["card", id],
    queryFn: () => fetcher(`/api/cards/${id}`),
    enabled: !!id && isOpen,
  });

  useEffect(() => {
    if (isError && error) {
      const err = error as Error & { status?: number };
      if (err.status === 403) {
        toast.error("Bạn không còn quyền truy cập bảng này.");
      } else if (err.status === 404) {
        toast.error("Thẻ không tồn tại hoặc đã bị xóa.");
      } else {
        toast.error("Có lỗi xảy ra khi tải dữ liệu thẻ.");
      }
      onClose();
    }
  }, [isError, error, onClose]);

  const { data: auditLogsData } = useQuery<AuditLog[]>({
    queryKey: ["card-logs", id],
    queryFn: () => fetcher(`/api/cards/${id}/logs`),
    enabled: !!id && isOpen,
  });

  const { data: commentsData } = useQuery<CardCommentWithReplies[]>({
    queryKey: ["card-comments", id],
    queryFn: () => fetcher(`/api/cards/${id}/comments`),
    enabled: !!id && isOpen,
  });
  const canEdit = cardData?.currentMemberRole !== BoardMemberRole.VIEWER;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <CardRealtimeSync cardId={id} isOpen={isOpen} />
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="sm:max-w-5xl w-[calc(100%-2rem)] h-[min(760px,calc(100vh-4rem))] rounded-2xl p-0 overflow-hidden shadow-2xl border border-neutral-200 flex flex-col"
      >
        <DialogTitle className="sr-only">
          {cardData?.title || "Chi tiết thẻ"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Chi tiết thẻ và nhật ký hoạt động
        </DialogDescription>
        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-12 gap-x-8 p-7 items-start overflow-y-auto styled-scrollbar">
          <div className="col-span-1 md:col-span-7 border-r border-transparent md:border-neutral-200/80 pr-0 md:pr-8 space-y-7">
            {!cardData
              ? <Header.Skeleton />
              : <Header key={`header-${cardData.id}`} data={cardData} canEdit={canEdit} />
            }
            {!cardData
              ? <Metadata.Skeleton />
              : <Metadata key={`metadata-${cardData.id}`} data={cardData} canEdit={canEdit} />
            }
            {!cardData
              ? <Description.Skeleton />
              : <CardModalMainContent key={`main-content-${cardData.id}`} cardData={cardData} canEdit={canEdit} />
            }
          </div>
          <div className="col-span-1 md:col-span-5 pl-0 md:pl-2 space-y-6">
            {!auditLogsData
              ? <Activity.Skeleton />
              : <Activity 
                  items={auditLogsData} 
                  cardTitle={cardData?.title} 
                  memberNames={cardData?.boardMembers?.map((m) => m.userName) || []} 
                />
            }
            {!id
              ? <Comments.Skeleton />
              : (
                <Comments
                  cardId={id}
                  boardId={cardData?.list.boardId}
                  items={commentsData ?? []}
                  boardMembers={cardData?.boardMembers}
                  currentMemberRole={cardData?.currentMemberRole}
                />
              )
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

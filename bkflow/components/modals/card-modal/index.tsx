"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { CardCommentWithReplies, CardWithList } from "@/types";
import { fetcher } from "@/lib/fetcher";
import { AuditLog, BoardMemberRole } from "@prisma/client";
import { useCardModal } from "@/hooks/use-card-modal";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Header } from "./header";
import { Metadata } from "./metadata";
import { Description } from "./description";
import { Activity } from "./activity";
import { Comments } from "./comments";
import { CardRealtimeSync } from "./card-realtime-sync";
import { Checklists } from "./checklists";
import { Attachments } from "./attachments";
import { AiCardQualityAssistant } from "./ai-card-quality-assistant";
import { CardDependencies } from "./card-dependencies";

export const CardModal = () => {
  const id = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);

  const { data: cardData, error, isError } = useQuery<CardWithList>({
    queryKey: ["card", id],
    queryFn: () => fetcher(`/api/cards/${id}`),
    enabled: !!id,
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
    enabled: !!id,
  });

  const { data: commentsData } = useQuery<CardCommentWithReplies[]>({
    queryKey: ["card-comments", id],
    queryFn: () => fetcher(`/api/cards/${id}/comments`),
    enabled: !!id,
  });
  const canEdit = cardData?.currentMemberRole !== BoardMemberRole.VIEWER;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
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
              : <Header key={cardData.id} data={cardData} canEdit={canEdit} />
            }
            {!cardData
              ? <Metadata.Skeleton />
              : <Metadata data={cardData} canEdit={canEdit} />
            }
            {!cardData
              ? <Description.Skeleton />
              : (
                  <>
                    <Description data={cardData} canEdit={canEdit} />
                    <CardDependencies data={cardData} canEdit={canEdit} />
                    {canEdit && (
                      <AiCardQualityAssistant
                        cardId={cardData.id}
                        boardId={cardData.list.boardId}
                        description={cardData.description}
                        labels={cardData.labels || []}
                        boardLabels={cardData.boardLabels || []}
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
                )
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
              : canEdit ? (
                  <Comments
                    cardId={id}
                    boardId={cardData?.list.boardId}
                    items={commentsData ?? []}
                    boardMembers={cardData?.boardMembers}
                  />
                ) : null
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

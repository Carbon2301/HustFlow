"use client";

import { useQuery } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { fetcher } from "@/lib/fetcher";
import { AuditLog } from "@prisma/client";
import { useCardModal } from "@/hooks/use-card-modal";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Header } from "./header";
import { DueDate } from "./due-date";
import { Description } from "./description";
import { Activity } from "./activity";

export const CardModal = () => {
  const id = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);

  const { data: cardData } = useQuery<CardWithList>({
    queryKey: ["card", id],
    queryFn: () => fetcher(`/api/cards/${id}`),
    enabled: !!id,
  });

  const { data: auditLogsData } = useQuery<AuditLog[]>({
    queryKey: ["card-logs", id],
    queryFn: () => fetcher(`/api/cards/${id}/logs`),
    enabled: !!id,
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}
    >
      <DialogContent className="sm:max-w-5xl w-full rounded-2xl p-0 overflow-hidden shadow-2xl border border-neutral-200 flex flex-col">
        <DialogTitle className="sr-only">
          {cardData?.title || "Chi tiết thẻ"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Chi tiết thẻ và nhật ký hoạt động
        </DialogDescription>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-8 p-7 items-start">
          <div className="col-span-1 md:col-span-7 border-r border-transparent md:border-neutral-200/80 pr-0 md:pr-8 space-y-7">
            {!cardData
              ? <Header.Skeleton />
              : <Header data={cardData} />
            }
            {!cardData
              ? <DueDate.Skeleton />
              : <DueDate data={cardData} />
            }
            {!cardData
              ? <Description.Skeleton />
              : <Description data={cardData} />
            }
          </div>
          <div className="col-span-1 md:col-span-5 pl-0 md:pl-2">
            {!auditLogsData
              ? <Activity.Skeleton />
              : <Activity items={auditLogsData} />
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

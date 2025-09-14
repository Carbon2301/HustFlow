"use client";

import { useQuery } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { fetcher } from "@/lib/fetcher";
import { AuditLog } from "@prisma/client";
import { useCardModal } from "@/hooks/use-card-modal";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Header } from "./header";
import { Description } from "./description";
import { Actions } from "./actions";
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
      <DialogContent className="max-w-2xl w-full rounded-2xl p-0 overflow-hidden shadow-2xl border border-neutral-200">
        <DialogTitle className="sr-only">
          {cardData?.title || "Card details"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Card details and activities
        </DialogDescription>
        <div className="p-5 pb-0">
          {!cardData
            ? <Header.Skeleton />
            : <Header data={cardData} />
          }
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0 p-5 pt-2">
          <div className="col-span-3 pr-0 md:pr-5 space-y-5">
            {!cardData
              ? <Description.Skeleton />
              : <Description data={cardData} />
            }
            {!auditLogsData
              ? <Activity.Skeleton />
              : <Activity items={auditLogsData} />
            }
          </div>
          <div className="mt-4 md:mt-0">
            {!cardData
              ? <Actions.Skeleton />
              : <Actions data={cardData} />
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
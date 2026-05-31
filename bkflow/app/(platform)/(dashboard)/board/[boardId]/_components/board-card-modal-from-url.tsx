"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCardModal } from "@/hooks/use-card-modal";

export const BoardCardModalFromUrl = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = searchParams.get("cardId");
  const checklistItemId = searchParams.get("checklistItemId") || undefined;
  const onOpen = useCardModal((state) => state.onOpen);
  const openedFromUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cardId) {
      openedFromUrlRef.current = null;
      return;
    }

    const openKey = `${cardId}:${checklistItemId ?? ""}`;

    if (openedFromUrlRef.current === openKey) {
      return;
    }

    openedFromUrlRef.current = openKey;
    onOpen(cardId, {
      checklistItemId,
      onClose: () => {
        const url = new URL(window.location.href);

        if (url.searchParams.get("cardId") !== cardId) {
          return;
        }

        url.searchParams.delete("cardId");
        url.searchParams.delete("checklistItemId");
        router.replace(`${url.pathname}${url.search}${url.hash}`, {
          scroll: false,
        });
      },
    });
  }, [cardId, checklistItemId, onOpen, router]);

  return null;
};

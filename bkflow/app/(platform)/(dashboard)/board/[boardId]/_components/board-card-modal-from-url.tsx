"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useCardModal } from "@/hooks/use-card-modal";

export const BoardCardModalFromUrl = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cardId = searchParams.get("cardId");
  const onOpen = useCardModal((state) => state.onOpen);
  const openedFromUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!cardId) {
      openedFromUrlRef.current = null;
      return;
    }

    if (openedFromUrlRef.current === cardId) {
      return;
    }

    openedFromUrlRef.current = cardId;
    onOpen(cardId, {
      onClose: () => {
        const url = new URL(window.location.href);

        if (url.searchParams.get("cardId") !== cardId) {
          return;
        }

        url.searchParams.delete("cardId");
        router.replace(`${url.pathname}${url.search}${url.hash}`, {
          scroll: false,
        });
      },
    });
  }, [cardId, onOpen, router]);

  return null;
};

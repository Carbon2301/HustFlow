"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const useBoardCalendarInvalidation = (boardId?: string | null) => {
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (!boardId) {
      return;
    }

    queryClient.invalidateQueries({
      queryKey: ["board-calendar", boardId],
    });
  }, [boardId, queryClient]);
};

export const BOARD_CARD_CALENDAR_DRAG_MIME = "application/x-bkflow-board-card";

export type BoardCardCalendarDragPayload = {
  kind: "board-card";
  cardId: string;
  title: string;
  isCompleted: boolean;
  startDate?: string | null;
  dueDate?: string | null;
  reminder?: string | null;
};

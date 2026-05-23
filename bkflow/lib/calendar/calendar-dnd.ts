export const BOARD_CARD_CALENDAR_DRAG_MIME = "application/x-hustflow-board-card";

export type BoardCardCalendarDragPayload = {
  kind: "board-card";
  cardId: string;
  boardId: string;
  title: string;
  isCompleted: boolean;
  startDate?: string | null;
  dueDate?: string | null;
  reminder?: string | null;
};

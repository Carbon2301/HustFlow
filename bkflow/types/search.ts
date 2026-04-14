export type BoardSearchResult = (
  | {
      type: "card";
      id: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
    }
  | {
      type: "description";
      id: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string;
    }
  | {
      type: "checklist";
      id: string;
      checklistId: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
    }
  | {
      type: "checklist-item";
      id: string;
      checklistItemId: string;
      checklistTitle: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
    }
  | {
      type: "comment";
      id: string;
      commentId: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
      userName?: string;
    }
  | {
      type: "attachment";
      id: string;
      attachmentId: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
      attachmentType: "LINK" | "FILE";
    }
) & {
  isArchived: boolean;
};

export type BoardSearchResponse = {
  items: BoardSearchResult[];
};

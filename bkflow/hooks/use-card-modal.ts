import { create } from "zustand";

type CardModalOpenOptions = {
  checklistItemId?: string;
};

type CardModalStore = {
  id?: string;
  targetChecklistItemId?: string;
  isOpen: boolean;
  onOpen: (id: string, options?: CardModalOpenOptions) => void;
  onClose: () => void;
  clearTargetChecklistItem: () => void;
};

export const useCardModal = create<CardModalStore>((set) => ({
  id: undefined,
  targetChecklistItemId: undefined,
  isOpen: false,
  onOpen: (id: string, options?: CardModalOpenOptions) =>
    set({
      isOpen: true,
      id,
      targetChecklistItemId: options?.checklistItemId,
    }),
  onClose: () => set({
    isOpen: false,
    id: undefined,
    targetChecklistItemId: undefined,
  }),
  clearTargetChecklistItem: () => set({ targetChecklistItemId: undefined }),
}));

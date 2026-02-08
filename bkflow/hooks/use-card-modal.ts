import { create } from "zustand";

type CardModalOpenOptions = {
  checklistItemId?: string;
  onClose?: () => void;
};

type CardModalStore = {
  id?: string;
  targetChecklistItemId?: string;
  closeCallback?: () => void;
  isOpen: boolean;
  onOpen: (id: string, options?: CardModalOpenOptions) => void;
  onClose: () => void;
  clearTargetChecklistItem: () => void;
};

export const useCardModal = create<CardModalStore>((set, get) => ({
  id: undefined,
  targetChecklistItemId: undefined,
  closeCallback: undefined,
  isOpen: false,
  onOpen: (id: string, options?: CardModalOpenOptions) =>
    set({
      isOpen: true,
      id,
      targetChecklistItemId: options?.checklistItemId,
      closeCallback: options?.onClose,
    }),
  onClose: () => {
    const closeCallback = get().closeCallback;

    set({
      isOpen: false,
      id: undefined,
      targetChecklistItemId: undefined,
      closeCallback: undefined,
    });

    closeCallback?.();
  },
  clearTargetChecklistItem: () => set({ targetChecklistItemId: undefined }),
}));

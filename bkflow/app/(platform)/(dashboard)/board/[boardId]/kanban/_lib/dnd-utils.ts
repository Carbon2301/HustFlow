import { CardWithAssignees } from "@/types";

export function reorder<T>(list: T[], startIndex: number, endIndex: number) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

export const getDestinationIndex = ({
  actualCards,
  visibleCards,
  destinationIndex,
}: {
  actualCards: CardWithAssignees[];
  visibleCards: CardWithAssignees[];
  destinationIndex: number;
}) => {
  const targetVisibleCard = visibleCards[destinationIndex];

  if (targetVisibleCard) {
    return actualCards.findIndex((card) => card.id === targetVisibleCard.id);
  }

  const lastVisibleCard = visibleCards[destinationIndex - 1];

  if (lastVisibleCard) {
    const lastVisibleIndex = actualCards.findIndex(
      (card) => card.id === lastVisibleCard.id,
    );

    return lastVisibleIndex + 1;
  }

  return actualCards.length;
};

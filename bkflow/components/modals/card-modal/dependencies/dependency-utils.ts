import type {
  CardDependencyWithBlockedCard,
  CardDependencyWithBlockerCard,
} from "@/types";

export type DependencyMode = "blocked-by" | "blocking";

export type DependencyListItem =
  | {
      dependency: CardDependencyWithBlockerCard;
      relatedCard: CardDependencyWithBlockerCard["blockerCard"];
    }
  | {
      dependency: CardDependencyWithBlockedCard;
      relatedCard: CardDependencyWithBlockedCard["blockedCard"];
    };

export const dependencyModeOptions = [
  {
    value: "blocked-by" as const,
    label: "Bị chặn bởi",
  },
  {
    value: "blocking" as const,
    label: "Chặn thẻ",
  },
];

export const getLinkedCardIds = ({
  linkedBlockerIds,
  linkedBlockeeIds,
}: {
  linkedBlockerIds: Set<string>;
  linkedBlockeeIds: Set<string>;
}) => new Set([...linkedBlockerIds, ...linkedBlockeeIds]);

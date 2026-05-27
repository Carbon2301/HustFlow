import { format } from "date-fns";
import { vi } from "date-fns/locale";

import type { CardWithList } from "@/types";
import { isAssignableBoardMember } from "@/lib/boards/board-member-role";

export const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");
  return initials.toUpperCase() || "U";
};

export const getFilteredBoardMembers = (
  boardMembers: CardWithList["boardMembers"],
  searchQuery: string,
) => {
  return boardMembers.filter((member) => {
    if (!isAssignableBoardMember(member)) {
      return false;
    }

    const nameMatch = member.userName.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = member.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    return nameMatch || emailMatch;
  });
};

export const getDateSummary = ({
  startDate,
  dueDate,
  hasStartDate,
  hasDueDate,
}: {
  startDate: CardWithList["startDate"];
  dueDate: CardWithList["dueDate"];
  hasStartDate: boolean;
  hasDueDate: boolean;
}) => {
  const formattedDate = dueDate
    ? format(new Date(dueDate), "H:mm d 'thg' M", { locale: vi })
    : "";
  const formattedStartDate = startDate
    ? format(new Date(startDate), "H:mm d 'thg' M", { locale: vi })
    : "";

  return hasStartDate && hasDueDate
    ? `Bắt đầu ${formattedStartDate} - Hết hạn ${formattedDate}`
    : hasStartDate
      ? `Bắt đầu ${formattedStartDate}`
      : hasDueDate
        ? `Hết hạn ${formattedDate}`
        : "";
};

export const humanizeReminderMinutes = (mins: number) => {
  if (mins >= 1440) return `${Math.floor(mins / 1440)} ngày`;
  if (mins >= 60) return `${Math.floor(mins / 60)} giờ`;
  return `${mins} phút`;
};

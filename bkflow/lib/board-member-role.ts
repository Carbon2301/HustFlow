import { BoardMemberRole } from "@prisma/client";

export const getRoleLabel = (role: BoardMemberRole) => {
  return role === BoardMemberRole.ADMIN ? "Quản trị viên" : "Thành viên";
};

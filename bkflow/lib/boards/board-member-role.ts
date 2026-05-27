import { BoardMemberRole } from "@prisma/client";
import type { BoardMember } from "@prisma/client";

export const getRoleLabel = (role: BoardMemberRole) => {
  if (role === BoardMemberRole.ADMIN) {
    return "Quản trị viên";
  }

  if (role === BoardMemberRole.VIEWER) {
    return "Chỉ xem";
  }

  return "Thành viên";
};

export const boardMemberRoleDescriptions: Record<BoardMemberRole, string> = {
  [BoardMemberRole.ADMIN]: "Quản lý bảng và thành viên.",
  [BoardMemberRole.MEMBER]: "Tạo, sửa và sắp xếp công việc.",
  [BoardMemberRole.VIEWER]: "Chỉ xem tiến độ, không chỉnh sửa.",
};

export const boardMemberRoleOptions: BoardMemberRole[] = [
  BoardMemberRole.MEMBER,
  BoardMemberRole.VIEWER,
  BoardMemberRole.ADMIN,
];

export const isAssignableBoardMemberRole = (role: BoardMemberRole) =>
  role !== BoardMemberRole.VIEWER;

export const isAssignableBoardMember = (
  member: Pick<BoardMember, "role">,
) => isAssignableBoardMemberRole(member.role);

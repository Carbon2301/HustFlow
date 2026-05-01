import type { Role, WorkspaceSettingsMember } from "../_types";
import { ADMIN_ROLE, MEMBER_ROLE } from "../_types";

export const roleLabels: Record<Role, string> = {
  [ADMIN_ROLE]: "Quản trị viên",
  [MEMBER_ROLE]: "Thành viên",
};

export const availableRoles: Role[] = [MEMBER_ROLE, ADMIN_ROLE];

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

export const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export const getErrorMessage = async (response: Response) => {
  const text = await response.text();

  return text || "Có lỗi xảy ra. Vui lòng thử lại.";
};

export const filterMembers = (members: WorkspaceSettingsMember[], query: string) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return members;
  }

  return members.filter((member) =>
    [member.name, member.email, roleLabels[member.role]]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );
};

export const getSettingsHref = (organizationId: string, tab: "general" | "members" | "invitations") => {
  const suffix = tab === "general" ? "" : `/${tab}`;

  return `/organization/${organizationId}/settings${suffix}`;
};

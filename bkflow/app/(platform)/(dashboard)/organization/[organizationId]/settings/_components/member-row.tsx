"use client";

import { MoreHorizontal, UserMinus } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import type { Role, WorkspaceSettingsMember } from "../_types";
import { formatDate, getInitials } from "../_lib/settings-utils";
import { ConfirmButton, RoleBadge, RolePicker } from "./settings-controls";

export const MemberRow = ({
  member,
  isAdmin,
  isLastAdmin,
  actionPending,
  onRoleChange,
  onRemove,
}: {
  member: WorkspaceSettingsMember;
  isAdmin: boolean;
  isLastAdmin: boolean;
  actionPending: boolean;
  onRoleChange: (role: Role) => void;
  onRemove: () => Promise<boolean>;
}) => {
  const roleDisabled = actionPending || isLastAdmin;

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={member.imageUrl} alt={member.name} />
            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-neutral-900">{member.name}</p>
              {member.isCurrentUser && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  Bạn
                </span>
              )}
            </div>
            <p className="truncate text-xs text-neutral-500">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-neutral-600">{formatDate(member.createdAt)}</td>
      <td className="px-4 py-3">
        {isAdmin ? (
          <RolePicker value={member.role} onChange={onRoleChange} disabled={roleDisabled} />
        ) : (
          <RoleBadge role={member.role} />
        )}
      </td>
      {isAdmin && (
        <td className="px-4 py-3 text-right">
          {!isLastAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon-sm" variant="ghost" disabled={actionPending}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52">
                <ConfirmButton
                  asMenuItem
                  disabled={actionPending}
                  title="Xóa thành viên?"
                  description={`${member.name} sẽ bị xóa khỏi tổ chức.`}
                  buttonLabel="Xóa thành viên"
                  confirmLabel="Xóa thành viên"
                  icon={UserMinus}
                  variant="destructive"
                  onConfirm={onRemove}
                />
              </PopoverContent>
            </Popover>
          )}
        </td>
      )}
    </tr>
  );
};

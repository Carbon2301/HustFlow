"use client";

import { BoardMember, BoardMemberRole } from "@prisma/client";
import { Check, Eye, Plus, ShieldCheck, UserRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { addBoardMember } from "@/actions/boards/add-board-member";
import { removeBoardMember } from "@/actions/boards/remove-board-member";
import { updateBoardMemberRole } from "@/actions/boards/update-board-member-role";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Hint } from "@/components/hint";
import { useAction } from "@/hooks/use-action";
import {
  boardMemberRoleDescriptions,
  boardMemberRoleOptions,
  getRoleLabel,
} from "@/lib/board-member-role";
import { ClerkOrgMember } from "@/lib/clerk-org-members";
import { cn } from "@/lib/utils";

import { BoardMemberAvatarPopover } from "./board-member-avatar-popover";

interface BoardMembersProps {
  boardId: string;
  members: BoardMember[];
  organizationMembers: ClerkOrgMember[];
  currentUserId: string;
  canManage: boolean;
}

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

const RoleIcon = ({ role }: { role: BoardMemberRole }) => {
  if (role === BoardMemberRole.ADMIN) {
    return <ShieldCheck className="h-3.5 w-3.5" />;
  }

  if (role === BoardMemberRole.VIEWER) {
    return <Eye className="h-3.5 w-3.5" />;
  }

  return <UserRound className="h-3.5 w-3.5" />;
};

const RoleBadge = ({ role }: { role: BoardMemberRole }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium",
      role === BoardMemberRole.ADMIN
        ? "bg-violet-50 text-violet-700"
        : role === BoardMemberRole.VIEWER
          ? "bg-sky-50 text-sky-700"
          : "bg-neutral-100 text-neutral-600",
    )}
  >
    {getRoleLabel(role)}
  </span>
);

const RolePicker = ({
  value,
  onChange,
  disabled,
}: {
  value: BoardMemberRole;
  onChange: (role: BoardMemberRole) => void;
  disabled?: boolean;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        className="h-8 min-w-[112px] justify-start gap-x-1.5 rounded-md px-2 text-xs text-neutral-600"
      >
        <RoleIcon role={value} />
        {getRoleLabel(value)}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-64 p-1.5">
      {boardMemberRoleOptions.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange(role)}
          className={cn(
            "flex w-full items-start gap-x-2 rounded-md px-2 py-2 text-left transition hover:bg-neutral-50",
            value === role && "bg-neutral-50",
          )}
        >
          <span className="mt-0.5 text-neutral-500">
            <RoleIcon role={role} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-neutral-700">
              {getRoleLabel(role)}
            </span>
            <span className="block text-xs leading-snug text-neutral-400">
              {boardMemberRoleDescriptions[role]}
            </span>
          </span>
          {value === role && <Check className="mt-0.5 h-3.5 w-3.5 text-violet-600" />}
        </button>
      ))}
    </PopoverContent>
  </Popover>
);

export const BoardMembers = ({
  boardId,
  members,
  organizationMembers,
  currentUserId,
  canManage,
}: BoardMembersProps) => {
  const router = useRouter();
  const [newMemberRoles, setNewMemberRoles] = useState<Record<string, BoardMemberRole>>({});
  const boardMemberUserIds = useMemo(
    () => new Set(members.map((member) => member.userId)),
    [members],
  );
  const availableMembers = organizationMembers.filter(
    (member) => !boardMemberUserIds.has(member.userId),
  );
  const adminCount = members.filter((member) => member.role === BoardMemberRole.ADMIN).length;

  const { execute: executeAddBoardMember, isLoading: isAdding } = useAction(
    addBoardMember,
    {
      onSuccess: (member) => {
        toast.success(`Đã thêm ${member.userName} vào bảng này`);
        router.refresh();
      },
      onError: (error) => {
        toast.error(error);
      },
    },
  );

  const { execute: executeRemoveBoardMember, isLoading: isRemoving } =
    useAction(removeBoardMember, {
      onSuccess: (member) => {
        toast.success(`Đã xóa ${member.userName} khỏi bảng này`);
        router.refresh();
      },
      onError: (error) => {
        toast.error(error);
      },
    });

  const { execute: executeUpdateRole, isLoading: isUpdatingRole } = useAction(
    updateBoardMemberRole,
    {
      onSuccess: (member) => {
        toast.success(`Đã đổi vai trò của ${member.userName} thành ${getRoleLabel(member.role)}`);
        router.refresh();
      },
      onError: (error) => {
        toast.error(error);
      },
    },
  );

  const isMutating = isAdding || isRemoving || isUpdatingRole;

  return (
    <div className="flex items-center gap-x-2">
      {members.length > 0 && (
        <AvatarGroup className="hidden sm:flex">
          {members.slice(0, 5).map((member) => {
            const isLastAdmin =
              member.role === BoardMemberRole.ADMIN && adminCount <= 1;

            return (
              <BoardMemberAvatarPopover
                key={member.id}
                boardId={boardId}
                member={member}
                canManage={canManage}
                isLastAdmin={isLastAdmin}
              />
            );
          })}
        </AvatarGroup>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="transparent"
            size="sm"
            className="h-8 gap-x-2 border-white/20 bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {canManage ? "Thêm thành viên" : "Thành viên"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[430px] p-3">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-neutral-800">
                Thành viên trong bảng
              </p>
              <p className="text-xs text-neutral-500">
                {canManage
                  ? "Quản trị viên có thể đổi vai trò hoặc xóa thành viên."
                  : "Bạn có thể xem vai trò của các thành viên trong bảng."}
              </p>
            </div>

            <div className="space-y-1.5">
              {members.map((member) => {
                const isLastAdmin =
                  member.role === BoardMemberRole.ADMIN && adminCount <= 1;
                const isCurrentUser = member.userId === currentUserId;

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-x-2 rounded-md px-2 py-1.5 hover:bg-neutral-50"
                  >
                    <Avatar size="sm">
                      <AvatarImage src={member.userImage} alt={member.userName} />
                      <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-x-1.5">
                        <p className="truncate text-sm font-medium text-neutral-700">
                          {member.userName}
                        </p>
                        <RoleBadge role={member.role} />
                      </div>
                      {member.userEmail && (
                        <p className="truncate text-xs text-neutral-400">
                          {member.userEmail}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-x-1">
                        <RolePicker
                          value={member.role}
                          disabled={isMutating || isLastAdmin}
                          onChange={(role) => {
                            if (role === member.role) {
                              return;
                            }

                            executeUpdateRole({
                              boardId,
                              boardMemberId: member.id,
                              role,
                            });
                          }}
                        />
                        <Hint
                          description={
                            isLastAdmin
                              ? "Bảng phải có ít nhất một quản trị viên"
                              : "Xóa khỏi bảng"
                          }
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={isMutating || isLastAdmin}
                            onClick={() =>
                              executeRemoveBoardMember({
                                boardId,
                                boardMemberId: member.id,
                              })
                            }
                            aria-label={`Xóa ${member.userName}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </Hint>
                      </div>
                    )}
                    {!canManage && isCurrentUser && (
                      <span className="text-xs text-neutral-400">Bạn</span>
                    )}
                  </div>
                );
              })}
            </div>

            {canManage && (
              <div className="border-t border-neutral-100 pt-3">
                <p className="mb-1.5 text-xs font-semibold uppercase text-neutral-400">
                  Thành viên tổ chức
                </p>
                <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                  {availableMembers.length === 0 ? (
                    <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                      Tất cả thành viên đã có trong bảng này.
                    </p>
                  ) : (
                    availableMembers.map((member) => {
                      const selectedRole = newMemberRoles[member.userId] ?? BoardMemberRole.MEMBER;

                      return (
                        <div
                          key={member.userId}
                          className="flex w-full items-center gap-x-2 rounded-md px-2 py-1.5 text-left transition hover:bg-neutral-50"
                        >
                          <Avatar size="sm">
                            <AvatarImage src={member.imageUrl} alt={member.name} />
                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-neutral-700">
                              {member.name}
                            </p>
                            {member.email && (
                              <p className="truncate text-xs text-neutral-400">
                                {member.email}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-x-1">
                            <RolePicker
                              value={selectedRole}
                              disabled={isMutating}
                              onChange={(role) =>
                                setNewMemberRoles((current) => ({
                                  ...current,
                                  [member.userId]: role,
                                }))
                              }
                            />
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              disabled={isMutating}
                              onClick={() =>
                                executeAddBoardMember({
                                  boardId,
                                  memberUserId: member.userId,
                                  role: selectedRole,
                                })
                              }
                              aria-label={`Thêm ${member.name}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

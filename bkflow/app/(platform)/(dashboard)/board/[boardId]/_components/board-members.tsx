"use client";

import { BoardMember } from "@prisma/client";
import { Plus, X } from "lucide-react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { addBoardMember } from "@/actions/add-board-member";
import { removeBoardMember } from "@/actions/remove-board-member";
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
import { ClerkOrgMember } from "@/lib/clerk-org-members";

interface BoardMembersProps {
  boardId: string;
  members: BoardMember[];
  organizationMembers: ClerkOrgMember[];
}

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

export const BoardMembers = ({
  boardId,
  members,
  organizationMembers,
}: BoardMembersProps) => {
  const router = useRouter();
  const boardMemberUserIds = useMemo(
    () => new Set(members.map((member) => member.userId)),
    [members],
  );
  const availableMembers = organizationMembers.filter(
    (member) => !boardMemberUserIds.has(member.userId),
  );

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

  return (
    <div className="flex items-center gap-x-2">
      {members.length > 0 && (
        <AvatarGroup className="hidden sm:flex">
          {members.slice(0, 5).map((member) => (
            <Hint key={member.id} description={member.userName}>
              <Avatar size="sm" className="bg-white">
                <AvatarImage src={member.userImage} alt={member.userName} />
                <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
              </Avatar>
            </Hint>
          ))}
        </AvatarGroup>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="transparent"
            size="sm"
            className="h-8 gap-x-2 border-white/20 bg-white/10 text-white hover:bg-white/20"
          >
            <Plus className="h-4 w-4" />
            Thêm thành viên
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-3">
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-neutral-800">
                Thành viên trong bảng
              </p>
              <p className="text-xs text-neutral-500">
                Chỉ chọn người đã thuộc tổ chức hiện tại.
              </p>
            </div>

            <div className="space-y-1.5">
              {members.length === 0 ? (
                <p className="rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
                  Chưa có thành viên nào trong bảng.
                </p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-x-2 rounded-md px-2 py-1.5 hover:bg-neutral-50"
                  >
                    <Avatar size="sm">
                      <AvatarImage src={member.userImage} alt={member.userName} />
                      <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-700">
                        {member.userName}
                      </p>
                      {member.userEmail && (
                        <p className="truncate text-xs text-neutral-400">
                          {member.userEmail}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={isRemoving || isAdding}
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
                  </div>
                ))
              )}
            </div>

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
                  availableMembers.map((member) => (
                    <button
                      key={member.userId}
                      type="button"
                      disabled={isAdding || isRemoving}
                      onClick={() =>
                        executeAddBoardMember({
                          boardId,
                          memberUserId: member.userId,
                        })
                      }
                      className="flex w-full items-center gap-x-2 rounded-md px-2 py-1.5 text-left transition hover:bg-neutral-50 disabled:opacity-50"
                    >
                      <Avatar size="sm">
                        <AvatarImage src={member.imageUrl} alt={member.name} />
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-700">
                          {member.name}
                        </p>
                        {member.email && (
                          <p className="truncate text-xs text-neutral-400">
                            {member.email}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

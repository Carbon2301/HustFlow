"use client";

import { useEffect, useRef, useState } from "react";
import { BoardMember, BoardMemberRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Check, Eye, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";

import { updateBoardMemberRole } from "@/actions/boards/update-board-member-role";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAction } from "@/hooks/use-action";
import {
  boardMemberRoleDescriptions,
  boardMemberRoleOptions,
  getRoleLabel,
} from "@/lib/boards/board-member-role";
import { cn } from "@/lib/utils";

import { MemberProfileModal } from "./member-profile-modal";

interface BoardMemberAvatarPopoverProps {
  boardId: string;
  member: BoardMember;
  canManage: boolean;
  isLastAdmin: boolean;
}

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

const getUsername = (member: BoardMember) => {
  if (member.userEmail) {
    return `@${member.userEmail.split("@")[0]}`;
  }

  const normalized = member.userName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLowerCase();

  return normalized ? `@${normalized}` : "@user";
};

const RoleIcon = ({ role }: { role: BoardMemberRole }) => {
  if (role === BoardMemberRole.ADMIN) {
    return <ShieldCheck className="h-5 w-5 text-neutral-500" />;
  }

  if (role === BoardMemberRole.VIEWER) {
    return <Eye className="h-5 w-5 text-neutral-500" />;
  }

  return <UserRound className="h-5 w-5 text-neutral-500" />;
};

export const BoardMemberAvatarPopover = ({
  boardId,
  member,
  canManage,
  isLastAdmin,
}: BoardMemberAvatarPopoverProps) => {
  const router = useRouter();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const pushedPopoverHistoryRef = useRef(false);

  const { execute: executeUpdateRole, isLoading } = useAction(
    updateBoardMemberRole,
    {
      onSuccess: (updatedMember) => {
        toast.success(
          `Đã đổi vai trò của ${updatedMember.userName} thành ${getRoleLabel(updatedMember.role)}`,
        );
        setPopoverOpen(false);
        router.refresh();
      },
      onError: (error) => {
        toast.error(error);
      },
    },
  );

  useEffect(() => {
    if (!popoverOpen || profileOpen || typeof window === "undefined") {
      return;
    }

    window.history.pushState(
      { bkflowMemberAvatarPopover: member.userId },
      "",
      window.location.href,
    );
    pushedPopoverHistoryRef.current = true;

    const handlePopState = () => {
      pushedPopoverHistoryRef.current = false;
      setPopoverOpen(false);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [member.userId, popoverOpen, profileOpen]);

  const handlePopoverOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && pushedPopoverHistoryRef.current && typeof window !== "undefined") {
      pushedPopoverHistoryRef.current = false;
      window.history.back();
      return;
    }

    setPopoverOpen(nextOpen);
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="cursor-pointer rounded-full outline-none ring-white transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
            aria-label={`Mở hồ sơ ${member.userName}`}
          >
            <Avatar size="sm" className="bg-white">
              <AvatarImage src={member.userImage} alt={member.userName} />
              <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
            </Avatar>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={10}
          className="w-[345px] overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-xl"
        >
          <div className="relative h-24 bg-[#1868DB] px-5 pt-7 text-white">
            <PopoverClose asChild>
              <button
                type="button"
                className="absolute right-2.5 top-2.5 cursor-pointer rounded-md p-1 text-white/90 transition hover:bg-white/10 hover:text-white"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </PopoverClose>
            <div className="absolute -bottom-8 left-5 flex items-end gap-x-3.5">
              <Avatar className="h-24 w-24 border-2 border-white bg-[#0A5FD3]">
                <AvatarImage src={member.userImage} alt={member.userName} />
                <AvatarFallback className="bg-[#0A5FD3] text-4xl font-bold text-white">
                  {getInitials(member.userName)}
                </AvatarFallback>
              </Avatar>
              <div className="pb-11">
                <p className="max-w-[200px] truncate text-lg font-bold leading-tight">
                  {member.userName}
                </p>
                <p className="max-w-[200px] truncate text-[11px] font-semibold leading-tight text-white/90">
                  {getUsername(member)}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button
              type="button"
              onClick={() => {
                pushedPopoverHistoryRef.current = false;
                setPopoverOpen(false);
                setProfileOpen(true);
              }}
              className="flex h-13 w-full cursor-pointer items-center px-4 text-left text-base text-neutral-700 transition hover:bg-neutral-50"
            >
              Xem hồ sơ
            </button>

            {canManage && (
              <>
                <div className="mx-4 border-t border-neutral-200" />
                <div className={cn(isLastAdmin && "opacity-50")}>
                  {boardMemberRoleOptions.map((role) => (
                    <button
                      key={role}
                      type="button"
                      disabled={isLoading || isLastAdmin || role === member.role}
                      onClick={() =>
                        executeUpdateRole({
                          boardId,
                          boardMemberId: member.id,
                          role,
                        })
                      }
                      className="flex min-h-13 w-full cursor-pointer items-center gap-x-3 px-4 text-left text-base text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RoleIcon role={role} />
                      <span className="min-w-0 flex-1">
                        <span className="block">{getRoleLabel(role)}</span>
                        <span className="block text-xs leading-snug text-neutral-400">
                          {boardMemberRoleDescriptions[role]}
                        </span>
                      </span>
                      {role === member.role && (
                        <Check className="h-4 w-4 text-violet-600" />
                      )}
                    </button>
                  ))}
                </div>
                {isLastAdmin && (
                  <p className="mt-2 px-4 pb-3 text-xs text-neutral-400">
                    Bảng phải có ít nhất một quản trị viên.
                  </p>
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <MemberProfileModal
        open={profileOpen}
        onOpenChange={setProfileOpen}
        member={member}
        boardId={boardId}
      />
    </>
  );
};

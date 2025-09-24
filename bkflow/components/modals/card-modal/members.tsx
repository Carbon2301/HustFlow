"use client";

import { Users } from "lucide-react";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { assignCardMember } from "@/actions/assign-card-member";
import { unassignCardMember } from "@/actions/unassign-card-member";
import { CardWithList } from "@/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";

interface MembersProps {
  data: CardWithList;
}

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

export const Members = ({ data }: MembersProps) => {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const assignedBoardMemberIds = useMemo(
    () => new Set(data.assignees.map((assignee) => assignee.boardMemberId)),
    [data.assignees],
  );

  const invalidateCard = (cardId: string) => {
    queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
    router.refresh();
  };

  const { execute: executeAssign, isLoading: isAssigning } = useAction(
    assignCardMember,
    {
      onSuccess: (assignee) => {
        toast.success(`Đã giao cho ${assignee.boardMember.userName}`);
        invalidateCard(assignee.cardId);
      },
      onError: (error) => {
        toast.error(error);
      },
    },
  );

  const { execute: executeUnassign, isLoading: isUnassigning } = useAction(
    unassignCardMember,
    {
      onSuccess: (assignee) => {
        toast.success(`Đã bỏ giao ${assignee.boardMember.userName}`);
        invalidateCard(assignee.cardId);
      },
      onError: (error) => {
        toast.error(error);
      },
    },
  );

  const onToggleMember = (boardMemberId: string, checked: boolean) => {
    const boardId = params.boardId as string;

    if (checked) {
      executeAssign({
        boardId,
        cardId: data.id,
        boardMemberId,
      });
      return;
    }

    executeUnassign({
      boardId,
      cardId: data.id,
      boardMemberId,
    });
  };

  const isLoading = isAssigning || isUnassigning;

  return (
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Users className="h-5 w-5 text-neutral-500" />
      </div>
      <div className="w-full min-w-0">
        <p className="font-semibold text-base text-neutral-800 mb-2.5">
          Người phụ trách
        </p>
        {data.boardMembers.length === 0 ? (
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
            Hãy thêm thành viên vào bảng trước khi giao thẻ này.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.boardMembers.map((member) => {
              const checked = assignedBoardMemberIds.has(member.id);

              return (
                <label
                  key={member.id}
                  className="flex min-w-0 items-center gap-x-2 rounded-lg border border-neutral-100 bg-white px-2.5 py-2 shadow-sm transition hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLoading}
                    onChange={(event) =>
                      onToggleMember(member.id, event.target.checked)
                    }
                    className="h-4 w-4 rounded border-neutral-300 accent-violet-600"
                  />
                  <Avatar size="sm">
                    <AvatarImage src={member.userImage} alt={member.userName} />
                    <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 truncate text-sm font-medium text-neutral-700">
                    {member.userName}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

Members.Skeleton = function MembersSkeleton() {
  return (
    <div className="flex items-start gap-x-4 w-full">
      <Skeleton className="h-10 w-10 rounded-xl bg-neutral-100" />
      <div className="w-full space-y-3">
        <Skeleton className="w-24 h-5 rounded bg-neutral-100" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Skeleton className="h-10 rounded-lg bg-neutral-100" />
          <Skeleton className="h-10 rounded-lg bg-neutral-100" />
        </div>
      </div>
    </div>
  );
};

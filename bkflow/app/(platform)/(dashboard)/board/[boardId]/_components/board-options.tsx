"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Activity, Archive, Download, LogOut, MoreHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { BoardMemberRole, type BoardMember, type Label, type List } from "@prisma/client";

import { deleteBoard } from "@/actions/boards/delete-board";
import { leaveBoard } from "@/actions/boards/leave-board";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfirmModal } from "@/components/modals/confirm-modal";

import { ArchivedItemsModal } from "./archived-items-modal";
import { BoardActivityPopoverContent } from "./board-activity-popover-content";
import { BoardExportDialog } from "./board-export-dialog";
import { SmartCaptureDialog } from "./smart-capture-dialog";

interface BoardOptionsProps {
  id: string;
  title: string;
  orgId: string;
  currentUserId: string;
  currentMemberRole: BoardMemberRole;
  canDelete?: boolean;
  canEdit?: boolean;
  lists: Pick<List, "id" | "title">[];
  members: Pick<BoardMember, "id" | "userId" | "userName" | "userEmail" | "role">[];
  labels: Pick<Label, "id" | "title" | "color">[];
};

export const BoardOptions = ({
  id,
  title,
  orgId,
  currentUserId,
  currentMemberRole,
  canDelete = false,
  canEdit = false,
  lists,
  members,
  labels,
}: BoardOptionsProps) => {
  const router = useRouter();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [view, setView] = useState<"menu" | "activity">("menu");
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isSmartCaptureOpen, setIsSmartCaptureOpen] = useState(false);
  const currentBoardMember = members.find((member) => member.userId === currentUserId);
  const adminCount = members.filter((member) => member.role === BoardMemberRole.ADMIN).length;
  const isLastAdmin =
    (currentBoardMember?.role ?? currentMemberRole) === BoardMemberRole.ADMIN && adminCount <= 1;

  const { execute: executeDeleteBoard, isLoading: isDeleting } = useAction(deleteBoard, {
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeLeaveBoard, isLoading: isLeaving } = useAction(leaveBoard, {
    onSuccess: () => {
      toast.success("Đã rời khỏi bảng này.");
      router.push(`/organization/${orgId}`);
      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onDelete = () => {
    executeDeleteBoard({ id });
  };

  const onLeave = () => {
    executeLeaveBoard({ boardId: id });
  };

  const onPopoverOpenChange = (open: boolean) => {
    setIsPopoverOpen(open);

    if (!open) {
      setView("menu");
    }
  };

  return (
    <>
      <Popover open={isPopoverOpen} onOpenChange={onPopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button
            aria-label="Mở thao tác bảng"
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/20 rounded-lg cursor-pointer"
            variant="ghost"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          data-role="popover-content"
          className={view === "activity"
            ? "flex max-h-[620px] w-[420px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-lg"
            : "px-0 pt-3 pb-2 w-52 shadow-lg rounded-xl border border-neutral-200"
          }
          style={view === "activity" ? { maxHeight: "calc(100vh - 128px)" } : undefined}
          side="bottom"
          align="start"
        >
          {view === "activity" ? (
            <BoardActivityPopoverContent
              boardId={id}
              onBack={() => setView("menu")}
            />
          ) : (
            <>
              <div className="text-sm font-semibold text-center text-neutral-700 pb-2 border-b border-neutral-100 mb-2 px-4">
                Thao tác bảng
              </div>
              <PopoverClose asChild>
                <Button
                  className="h-7 w-7 p-0 absolute top-2 right-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md"
                  variant="ghost"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </PopoverClose>
              <Button
                id="board-activity-trigger"
                variant="ghost"
                onClick={() => setView("activity")}
                className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
              >
                <Activity className="h-4 w-4 text-neutral-400" />
                Hoạt động
              </Button>
              <PopoverClose asChild>
                <Button
                  id="board-export-trigger"
                  variant="ghost"
                  onClick={() => setIsExportDialogOpen(true)}
                  className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
                >
                  <Download className="h-4 w-4 text-neutral-400" />
                  Xuất dữ liệu
                </Button>
              </PopoverClose>
              {canEdit && (
                <PopoverClose asChild>
                  <Button
                    id="smart-capture-trigger"
                    variant="ghost"
                    onClick={() => setIsSmartCaptureOpen(true)}
                    className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
                  >
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Tạo nhanh thông minh
                  </Button>
                </PopoverClose>
              )}
              <PopoverClose asChild>
                <Button
                  id="archived-items-trigger"
                  variant="ghost"
                  onClick={() => setIsArchivedModalOpen(true)}
                  className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
                >
                  <Archive className="h-4 w-4 text-neutral-400" />
                  Mục đã lưu trữ
                </Button>
              </PopoverClose>
              <Hint
                description={
                  isLastAdmin
                    ? "Bảng phải có ít nhất một quản trị viên. Vui lòng chuyển quyền quản trị cho người khác trước khi rời bảng."
                    : "Rời khỏi bảng này"
                }
                side="right"
              >
                <span className="block">
                  <ConfirmModal
                    onConfirm={onLeave}
                    title="Rời khỏi bảng này?"
                    description="Bạn sẽ bị gỡ khỏi bảng này. Các phân công thẻ và checklist liên quan sẽ không còn hiển thị bạn là người phụ trách."
                    disabled={isLeaving || isLastAdmin}
                  >
                    <Button
                      variant="ghost"
                      disabled={isLeaving || isLastAdmin}
                      className="w-full h-9 px-4 justify-start font-normal text-sm text-amber-600 hover:bg-amber-50 hover:text-amber-700 gap-x-2 rounded-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {isLeaving ? "Đang rời..." : "Rời khỏi bảng"}
                    </Button>
                  </ConfirmModal>
                </span>
              </Hint>
              {canDelete && (
                <ConfirmModal
                  onConfirm={onDelete}
                  title="Xóa bảng này?"
                  description="Bạn có chắc chắn muốn xóa bảng này? Mọi danh sách và thẻ bên trong bảng sẽ bị xóa vĩnh viễn và không thể khôi phục."
                  disabled={isDeleting}
                >
                  <Button
                    variant="ghost"
                    className="w-full h-9 px-4 justify-start font-normal text-sm text-red-500 hover:bg-red-50 hover:text-red-600 gap-x-2 rounded-none cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isDeleting ? "Đang xóa..." : "Xóa bảng này"}
                  </Button>
                </ConfirmModal>
              )}
            </>
          )}
        </PopoverContent>
      </Popover>
      <ArchivedItemsModal
        boardId={id}
        open={isArchivedModalOpen}
        onOpenChange={setIsArchivedModalOpen}
      />
      <BoardExportDialog
        boardId={id}
        boardTitle={title}
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
      />
      <SmartCaptureDialog
        boardId={id}
        open={isSmartCaptureOpen}
        onOpenChange={setIsSmartCaptureOpen}
        lists={lists}
        members={members}
        labels={labels}
      />
    </>
  );
};

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";
import { Check, Kanban, LayoutGrid, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  BoardSwitcherBoard,
  BoardSwitcherData,
  BoardSwitcherOrganization,
} from "@/lib/boards/board-switcher";

type BoardSwitcherProps = {
  currentBoardId: string;
  currentOrgId: string;
  data: BoardSwitcherData;
};

const ALL_ORGANIZATIONS = "all";

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

export const BoardSwitcher = ({
  currentBoardId,
  currentOrgId,
  data,
}: BoardSwitcherProps) => {
  const router = useRouter();
  const { setActive } = useOrganizationList();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string>(ALL_ORGANIZATIONS);
  const [isPending, startTransition] = useTransition();

  const organizationById = useMemo(
    () =>
      new Map(
        data.organizations.map((organization) => [
          organization.id,
          organization,
        ]),
      ),
    [data.organizations],
  );

  const filteredBoards = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);

    return data.boards.filter((board) => {
      const matchesOrganization =
        selectedOrgId === ALL_ORGANIZATIONS || board.orgId === selectedOrgId;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        normalizeSearch(board.title).includes(normalizedQuery);

      return matchesOrganization && matchesQuery;
    });
  }, [data.boards, query, selectedOrgId]);

  const onSelectBoard = (board: BoardSwitcherBoard) => {
    if (board.id === currentBoardId) {
      setOpen(false);
      return;
    }

    startTransition(async () => {
      try {
        if (board.orgId !== currentOrgId) {
          if (!setActive) {
            throw new Error("Không thể chuyển không gian làm việc.");
          }

          await setActive({ organization: board.orgId });
        }

        setOpen(false);
        router.push(`/board/${board.id}`);
      } catch {
        toast.error("Không thể chuyển bảng. Vui lòng thử lại.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          aria-label="Chuyển đổi các bảng"
          variant="transparent"
          size="sm"
          className="ml-1 gap-x-2 text-white/90 hover:bg-white/20 hover:text-white font-medium"
        >
          <Kanban className="h-4 w-4" />
          <span className="hidden sm:inline">Chuyển đổi các bảng</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl w-[calc(100%-2rem)] h-[min(720px,calc(100vh-4rem))] gap-4 rounded-xl bg-white p-6 text-neutral-900 border border-neutral-200 shadow-2xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-x-2 text-neutral-900">
            <Kanban className="h-5 w-5 text-violet-600" />
            Chuyển đổi các bảng
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500">
            Tìm và chuyển nhanh sang các bảng làm việc khác của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm bảng của bạn"
            className="h-11 rounded-md border-neutral-300 pl-9 text-base focus-visible:ring-2 focus-visible:ring-blue-500"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <WorkspaceChip
            isActive={selectedOrgId === ALL_ORGANIZATIONS}
            label="Tất cả"
            onClick={() => setSelectedOrgId(ALL_ORGANIZATIONS)}
          />
          {data.organizations.map((organization) => (
            <WorkspaceChip
              key={organization.id}
              isActive={selectedOrgId === organization.id}
              label={organization.name}
              onClick={() => setSelectedOrgId(organization.id)}
            />
          ))}
        </div>

        {filteredBoards.length > 0 ? (
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
            {filteredBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                organization={organizationById.get(board.orgId)}
                isCurrent={board.id === currentBoardId}
                isPending={isPending}
                onSelect={onSelectBoard}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-28 flex-col items-center justify-center rounded-md border border-dashed border-neutral-200 text-center text-sm text-neutral-500">
            <LayoutGrid className="mb-2 h-5 w-5 text-neutral-400" />
            Không tìm thấy bảng phù hợp.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const WorkspaceChip = ({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "h-8 max-w-52 shrink-0 rounded-md border px-3 text-sm font-medium transition-colors cursor-pointer",
      "overflow-hidden text-ellipsis whitespace-nowrap",
      isActive
        ? "border-blue-500 bg-blue-50 text-blue-700"
        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50",
    )}
  >
    {label}
  </button>
);

const BoardCard = ({
  board,
  organization,
  isCurrent,
  isPending,
  onSelect,
}: {
  board: BoardSwitcherBoard;
  organization?: BoardSwitcherOrganization;
  isCurrent: boolean;
  isPending: boolean;
  onSelect: (board: BoardSwitcherBoard) => void;
}) => (
  <button
    type="button"
    disabled={isPending}
    onClick={() => onSelect(board)}
    className={cn(
      "group relative flex h-[180px] min-w-0 flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition cursor-pointer",
      "hover:-translate-y-0.5 hover:shadow-md disabled:pointer-events-none disabled:opacity-70",
      isCurrent ? "border-blue-500 ring-2 ring-blue-500/30" : "border-neutral-200",
    )}
  >
    <div
      className="h-24 w-full shrink-0 bg-neutral-200 bg-cover bg-center"
      style={{ backgroundImage: `url(${board.imageThumbUrl})` }}
    />
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-1 p-3">
      <div>
        <p className="line-clamp-2 text-sm font-bold leading-snug text-neutral-800">
          {board.title}
        </p>
        {organization && (
          <p className="mt-0.5 truncate text-xs font-medium text-neutral-500">
            {organization.name}
          </p>
        )}
      </div>
      {isCurrent && (
        <div className="flex items-center gap-1 text-xs font-semibold text-blue-700">
          <Check className="h-3.5 w-3.5" />
          Đang mở
        </div>
      )}
    </div>
  </button>
);

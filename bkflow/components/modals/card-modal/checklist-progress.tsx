"use client";

interface ChecklistProgressProps {
  completedCount: number;
  totalCount: number;
}

export const ChecklistProgress = ({
  completedCount,
  totalCount,
}: ChecklistProgressProps) => {
  const percentage = totalCount > 0
    ? Math.round((completedCount / totalCount) * 100)
    : 0;

  return (
    <div className="flex items-center gap-x-3 w-full pl-[52px]">
      <span className="text-xs text-neutral-500 font-semibold w-8 shrink-0">
        {percentage}%
      </span>
      <div className="w-full bg-neutral-100 h-2 rounded-full overflow-hidden border border-neutral-200/50 shadow-inner">
        <div
          style={{ width: `${percentage}%` }}
          className="h-full bg-violet-600 rounded-full transition-all duration-300"
        />
      </div>
    </div>
  );
};

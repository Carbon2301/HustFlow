"use client";

import { Sparkles } from "lucide-react";

import { useProModal } from "@/hooks/use-pro-modal";

export const UpgradeBillingTile = () => {
  const proModal = useProModal();

  return (
    <button
      type="button"
      onClick={proModal.onOpen}
      className="group aspect-video relative h-full w-full bg-violet-50 border-2 border-dashed border-violet-200 rounded-xl flex flex-col gap-y-1.5 items-center justify-center hover:bg-violet-100 hover:border-violet-300 transition-all duration-200 cursor-pointer text-center px-4"
    >
      <Sparkles className="h-5 w-5 text-violet-500 transition-colors" />
      <p className="text-sm font-medium text-violet-700">
        Nâng cấp Pro
      </p>
      <span className="text-xs text-violet-500">
        Tổ chức đã đạt giới hạn bảng miễn phí
      </span>
    </button>
  );
};

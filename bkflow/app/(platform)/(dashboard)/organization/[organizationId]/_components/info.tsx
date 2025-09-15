"use client";

import Image from "next/image";
import { CreditCard, Sparkles } from "lucide-react";
import { useOrganization } from "@clerk/nextjs";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface InfoProps {
  isPro: boolean;
};

export const Info = ({
  isPro,
}: InfoProps) => {
  const { organization, isLoaded } = useOrganization();

  if (!isLoaded || !organization) {
    return (
      <Info.Skeleton />
    );
  }

  return (
    <div className="flex items-center gap-x-4 mb-6">
      <div className="w-14 h-14 relative flex-shrink-0">
        <Image
          fill
          src={organization.imageUrl}
          alt={organization.name}
          className="rounded-xl object-cover ring-2 ring-neutral-100"
        />
      </div>
      <div className="space-y-0.5">
        <p className="font-semibold text-xl text-neutral-900 leading-tight">
          {organization.name}
        </p>
        <div className={cn(
          "inline-flex items-center gap-x-1 text-xs font-medium px-2 py-0.5 rounded-full",
          isPro
            ? "bg-violet-50 text-violet-700 border border-violet-200"
            : "bg-neutral-100 text-neutral-500"
        )}>
          {isPro ? (
            <>
              <Sparkles className="h-3 w-3" />
              Gói Pro
            </>
          ) : (
            <>
              <CreditCard className="h-3 w-3" />
              Gói miễn phí
            </>
          )}
        </div>
      </div>
    </div>
  );
};

Info.Skeleton = function SkeletonInfo() {
  return (
    <div className="flex items-center gap-x-4 mb-6">
      <Skeleton className="w-14 h-14 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
};

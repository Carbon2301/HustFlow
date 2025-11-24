"use client";

import { useIsMounted } from "@/hooks/use-is-mounted";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface HintProps {
  children: React.ReactNode;
  description: string;
  side?: "left" | "right" | "top" | "bottom";
  sideOffset?: number;
  className?: string;
};

export const Hint = ({
  children,
  description,
  side = "bottom",
  sideOffset = 0,
  className
}: HintProps) => {
  const isMounted = useIsMounted();

  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent
          sideOffset={sideOffset}
          side={side}
          className={cn("text-xs max-w-[220px] break-words whitespace-pre-line", className)}
        >
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

"use client";

import { toast } from "sonner";
import { Sparkles, Settings } from "lucide-react";

import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { stripeRedirect } from "@/actions/billing/stripe-redirect";
import { useProModal } from "@/hooks/use-pro-modal";

interface SubscriptionButtonProps {
  isPro: boolean;
}

export const SubscriptionButton = ({
  isPro,
}: SubscriptionButtonProps) => {
  const proModal = useProModal();

  const { execute, isLoading } = useAction(stripeRedirect, {
    onSuccess: (data) => {
      window.location.href = data;
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onClick = () => {
    if (isPro) {
      execute({});
    } else {
      proModal.onOpen();
    }
  };

  return (
    <Button
      className={isPro
        ? "gap-x-2 rounded-lg h-9 font-medium"
        : "gap-x-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg h-9 font-medium shadow-sm"
      }
      variant={isPro ? "outline" : "default"}
      onClick={onClick}
      disabled={isLoading}
    >
      {isPro ? (
        <>
          <Settings className="h-4 w-4" />
          {isLoading ? "Đang tải..." : "Quản lý gói đăng ký"}
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Nâng cấp lên gói Pro
        </>
      )}
    </Button>
  );
};

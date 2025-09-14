"use client";

import Image from "next/image";
import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useProModal } from "@/hooks/use-pro-modal";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import { stripeRedirect } from "@/actions/stripe-redirect";
import { toast } from "sonner";

const features = [
  "Unlimited boards",
  "Advanced checklists",
  "Admin & security controls",
  "Priority support",
];

export const ProModal = () => {
  const proModal = useProModal();

  const { execute, isLoading } = useAction(stripeRedirect, {
    onSuccess: (data) => {
      window.location.href = data;
    },
    onError: (error) => {
      toast.error(error);
    }
  });

  const onClick = () => {
    execute({});
  };

  return (
    <Dialog
      open={proModal.isOpen}
      onOpenChange={proModal.onClose}
    >
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border border-neutral-200 shadow-2xl">
        {/* Hero image */}
        <div className="aspect-video relative flex items-center justify-center overflow-hidden">
          <Image
            src="/hero.svg"
            alt="BKFlow Pro"
            className="object-cover"
            fill
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          <div className="space-y-1">
            <div className="flex items-center gap-x-2">
              <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              </div>
              <DialogTitle className="font-bold text-lg text-neutral-900">
                Upgrade to BKFlow Pro
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-neutral-500 pl-9">
              Unlock everything BKFlow has to offer
            </DialogDescription>
          </div>

          <ul className="space-y-2 pl-1">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-x-2.5 text-sm text-neutral-700">
                <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3 text-violet-600" />
                </div>
                {feature}
              </li>
            ))}
          </ul>

          <Button
            disabled={isLoading}
            onClick={onClick}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 font-semibold shadow-sm hover:shadow-md transition-all"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isLoading ? "Redirecting…" : "Upgrade now"}
          </Button>
          <p className="text-xs text-center text-neutral-400">
            Cancel anytime · Secure payment via Stripe
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
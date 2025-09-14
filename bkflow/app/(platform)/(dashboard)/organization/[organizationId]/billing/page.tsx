import { checkSubscription } from "@/lib/subscription"
import { Separator } from "@/components/ui/separator";

import { SubscriptionButton } from "./_components/subscription-button";

import { Info } from "../_components/info";

const BillingPage = async () => {
  const isPro = await checkSubscription();

  return (
    <div className="w-full space-y-6">
      <Info isPro={isPro} />
      <Separator />
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-neutral-700">
            {isPro ? "Pro plan" : "Free plan"}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">
            {isPro
              ? "You have access to all Pro features. Manage or cancel your subscription below."
              : "You are on the free plan. Upgrade to unlock unlimited boards and more."}
          </p>
        </div>
        <SubscriptionButton isPro={isPro} />
      </div>
    </div>
  );
};

export default BillingPage;
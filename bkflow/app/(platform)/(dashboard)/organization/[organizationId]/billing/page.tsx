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
            {isPro ? "Gói Pro" : "Gói miễn phí"}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">
            {isPro
              ? "Bạn đã được truy cập vào tất cả tính năng của gói Pro. Quản lý hoặc hủy gói đăng ký của bạn bên dưới."
              : "Bạn đang sử dụng gói miễn phí. Nâng cấp để mở khóa số lượng bảng không giới hạn và các tính năng khác."}
          </p>
        </div>
        <SubscriptionButton isPro={isPro} />
      </div>
    </div>
  );
};

export default BillingPage;
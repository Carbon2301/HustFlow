import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { checkSubscription } from "@/lib/billing/subscription";
import { isOrganizationAdmin } from "@/lib/organization-permissions";
import { Separator } from "@/components/ui/separator";

import { SubscriptionButton } from "./_components/subscription-button";

import { Info } from "../_components/info";

const BillingPage = async () => {
  const { orgId, userId } = await auth();

  if (!orgId || !userId) {
    redirect("/select-org");
  }

  const [isPro, canManageBilling] = await Promise.all([
    checkSubscription(),
    isOrganizationAdmin(orgId, userId),
  ]);

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
              ? "Tổ chức đã được truy cập vào tất cả tính năng của gói Pro."
              : "Tổ chức đang sử dụng gói miễn phí. Nâng cấp để mở khóa số lượng bảng không giới hạn và các tính năng khác."}
          </p>
        </div>
        {canManageBilling ? (
          <SubscriptionButton isPro={isPro} />
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            Bạn có thể xem trạng thái gói, nhưng chỉ quản trị viên tổ chức mới có thể thay đổi thanh toán.
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingPage;

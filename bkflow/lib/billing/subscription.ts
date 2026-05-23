import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

import { db } from "@/lib/db";

const DAY_IN_MS = 86_400_000;

export const checkSubscription = cache(async () => {
  const { orgId } = await auth();

  if (!orgId) {
    return false;
  }

  const orgSubscription = await db.orgSubscription.findUnique({
    where: {
      orgId,
    },
    select: {
      stripeSubscriptionId: true,
      stripeCurrentPeriodEnd: true,
      stripeCustomerId: true,
      stripePriceId: true,
    },
  });

  if (!orgSubscription) {
    return false;
  }

  const currentPeriodEnd = orgSubscription.stripeCurrentPeriodEnd?.getTime();
  const isValid =
    orgSubscription.stripePriceId &&
    currentPeriodEnd &&
    currentPeriodEnd + DAY_IN_MS > Date.now()

  return !!isValid;
});

import Stripe from "stripe";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { stripe } from "@/lib/billing/stripe";
import { logger } from "@/lib/logger";

const getSubscriptionPeriodEnd = (subscription: Stripe.Subscription) => {
  return new Date(subscription.items.data[0].current_period_end * 1000);
};

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get("Stripe-Signature") as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (error) {
    logger.warn("[STRIPE_WEBHOOK_SIGNATURE_ERROR]", {
      route: "/api/webhook",
      action: "stripe-webhook-verify",
      error: error instanceof Error ? error.message : "Invalid signature",
    });

    return new NextResponse("Webhook error", { status: 400 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  try {
    if (event.type === "checkout.session.completed") {
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );

      if (!session?.metadata?.orgId) {
        logger.warn("[STRIPE_WEBHOOK_ORG_ID_MISSING]", {
          route: "/api/webhook",
          action: "stripe-webhook-process",
          stripeEventId: event.id,
          stripeEventType: event.type,
        });

        return new NextResponse("Org ID is required", { status: 400 });
      }

      await db.orgSubscription.create({
        data: {
          orgId: session?.metadata?.orgId,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: subscription.customer as string,
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: getSubscriptionPeriodEnd(subscription),
        },
      });
    }

    if (event.type === "invoice.payment_succeeded") {
      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      );

      await db.orgSubscription.update({
        where: {
          stripeSubscriptionId: subscription.id,
        },
        data: {
          stripePriceId: subscription.items.data[0].price.id,
          stripeCurrentPeriodEnd: getSubscriptionPeriodEnd(subscription),
        },
      });
    }

    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "invoice.payment_succeeded"
    ) {
      logger.info("[STRIPE_WEBHOOK_EVENT_IGNORED]", {
        route: "/api/webhook",
        action: "stripe-webhook-process",
        stripeEventId: event.id,
        stripeEventType: event.type,
      });
    }
  } catch (error) {
    logger.error("[STRIPE_WEBHOOK_PROCESSING_ERROR]", error, {
      route: "/api/webhook",
      action: "stripe-webhook-process",
      stripeEventId: event.id,
      stripeEventType: event.type,
    });

    return new NextResponse("Webhook processing error", { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
};

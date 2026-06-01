import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhook",
  "/api/uploadthing(.*)",
]);

const isAuthRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

const isSelectOrgRoute = createRouteMatcher(["/select-org(.*)"]);

export const proxy = clerkMiddleware(async (auth, req) => {
  const { userId, orgId } = await auth();

  if (!userId && !isPublicRoute(req)) {
    await auth.protect();
    return;
  }

  if (userId && isAuthRoute(req)) {
    const path = orgId ? `/organization/${orgId}` : "/select-org";
    return NextResponse.redirect(new URL(path, req.url));
  }

  if (userId && !orgId && !isSelectOrgRoute(req)) {
    return NextResponse.redirect(new URL("/select-org", req.url));
  }
});

export default proxy;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

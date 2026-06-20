import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await db.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "ok",
      timestamp,
    });
  } catch (error) {
    logger.error("[HEALTHCHECK_DATABASE_ERROR]", error, {
      route: "/api/health",
      action: "healthcheck",
    });

    return NextResponse.json(
      {
        status: "degraded",
        database: "error",
        timestamp,
      },
      { status: 503 },
    );
  }
}

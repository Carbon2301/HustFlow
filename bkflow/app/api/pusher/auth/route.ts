import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { parseRealtimeChannelName } from "@/lib/realtime/channels";
import { getServerPusher } from "@/lib/realtime/server";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const parsePusherAuthRequest = async (req: NextRequest) => {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as unknown;

    if (
      typeof body === "object" &&
      body !== null &&
      "socket_id" in body &&
      "channel_name" in body
    ) {
      const socketId = body.socket_id;
      const channelName = body.channel_name;

      if (typeof socketId === "string" && typeof channelName === "string") {
        return {
          socketId,
          channelName,
        };
      }
    }
  }

  const formData = await req.formData();
  const socketId = formData.get("socket_id");
  const channelName = formData.get("channel_name");

  if (typeof socketId !== "string" || typeof channelName !== "string") {
    return null;
  }

  return {
    socketId,
    channelName,
  };
};

export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const request = await parsePusherAuthRequest(req);

    if (!request) {
      return new NextResponse("Invalid Pusher auth request", { status: 400 });
    }

    const channelScope = parseRealtimeChannelName(request.channelName);

    if (!channelScope) {
      return new NextResponse("Unsupported realtime channel", { status: 403 });
    }

    if (channelScope.type === "user" && channelScope.userId !== userId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (channelScope.type === "org") {
      if (!orgId || channelScope.organizationId !== orgId) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    if (channelScope.type === "board") {
      const boardMembership = await db.boardMember.findUnique({
        where: {
          boardId_userId: {
            boardId: channelScope.boardId,
            userId,
          },
        },
        select: {
          id: true,
        },
      });

      if (!boardMembership) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    if (channelScope.type === "card") {
      const card = await db.card.findFirst({
        where: {
          id: channelScope.cardId,
          archivedAt: null,
          list: {
            archivedAt: null,
            board: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!card) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const authResponse = getServerPusher().authorizeChannel(
      request.socketId,
      request.channelName,
    );

    return NextResponse.json(authResponse);
  } catch (error) {
    logger.error("[PUSHER_AUTH_ERROR]", error, {
      route: "/api/pusher/auth",
      action: "pusher-auth",
    });

    return new NextResponse("Internal Error", { status: 500 });
  }
}

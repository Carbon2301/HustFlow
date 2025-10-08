import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { parseRealtimeChannelName } from "@/lib/realtime/channels";
import { getServerPusher } from "@/lib/realtime/server";
import { requireBoardMember } from "@/lib/permissions";
import { db } from "@/lib/db";

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

    if (!userId || !orgId) {
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

    if (channelScope.type === "org" && channelScope.organizationId !== orgId) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (channelScope.type === "board") {
      const permission = await requireBoardMember({
        boardId: channelScope.boardId,
        orgId,
        userId,
      });

      if (permission.error) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    if (channelScope.type === "card") {
      const card = await db.card.findUnique({
        where: {
          id: channelScope.cardId,
          list: {
            board: {
              orgId,
            },
          },
        },
        select: {
          list: {
            select: {
              boardId: true,
            },
          },
        },
      });

      if (!card) {
        return new NextResponse("Forbidden", { status: 403 });
      }

      const permission = await requireBoardMember({
        boardId: card.list.boardId,
        orgId,
        userId,
      });

      if (permission.error) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const authResponse = getServerPusher().authorizeChannel(
      request.socketId,
      request.channelName,
    );

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error("[PUSHER_AUTH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

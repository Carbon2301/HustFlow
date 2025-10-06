export const REALTIME_CHANNEL_PREFIX = "private" as const;

export const realtimeChannels = {
  org: (organizationId: string) =>
    `${REALTIME_CHANNEL_PREFIX}-org-${organizationId}` as const,
  board: (boardId: string) =>
    `${REALTIME_CHANNEL_PREFIX}-board-${boardId}` as const,
  user: (userId: string) =>
    `${REALTIME_CHANNEL_PREFIX}-user-${userId}` as const,
};

export type RealtimeChannelName =
  | ReturnType<typeof realtimeChannels.org>
  | ReturnType<typeof realtimeChannels.board>
  | ReturnType<typeof realtimeChannels.user>;

export type RealtimeChannelScope =
  | {
      type: "org";
      organizationId: string;
    }
  | {
      type: "board";
      boardId: string;
    }
  | {
      type: "user";
      userId: string;
    };

export const parseRealtimeChannelName = (
  channelName: string,
): RealtimeChannelScope | null => {
  const match = channelName.match(/^private-(org|board|user)-(.+)$/);

  if (!match) {
    return null;
  }

  const [, type, id] = match;

  if (!id) {
    return null;
  }

  if (type === "org") {
    return {
      type,
      organizationId: id,
    };
  }

  if (type === "board") {
    return {
      type,
      boardId: id,
    };
  }

  return {
    type: "user",
    userId: id,
  };
};

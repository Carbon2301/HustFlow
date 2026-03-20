import { clerkClient } from "@clerk/nextjs/server";
import { cache } from "react";

import { db } from "@/lib/db";

export type BoardSwitcherOrganization = {
  id: string;
  name: string;
  imageUrl?: string;
};

export type BoardSwitcherBoard = {
  id: string;
  title: string;
  orgId: string;
  imageThumbUrl: string;
};

export type BoardSwitcherData = {
  organizations: BoardSwitcherOrganization[];
  boards: BoardSwitcherBoard[];
};

export const getBoardSwitcherData = cache(async (
  userId: string,
): Promise<BoardSwitcherData> => {
  const client = await clerkClient();
  const memberships = await client.users.getOrganizationMembershipList({
    userId,
    limit: 100,
  });

  const organizations = memberships.data.map((membership) => ({
    id: membership.organization.id,
    name: membership.organization.name,
    imageUrl: membership.organization.imageUrl,
  }));
  const organizationIds = organizations.map((organization) => organization.id);

  if (organizationIds.length === 0) {
    return {
      organizations,
      boards: [],
    };
  }

  const boards = await db.board.findMany({
    where: {
      orgId: {
        in: organizationIds,
      },
      members: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      title: true,
      orgId: true,
      imageThumbUrl: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    organizations,
    boards,
  };
});

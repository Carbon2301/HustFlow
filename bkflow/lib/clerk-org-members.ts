import { clerkClient } from "@clerk/nextjs/server";
import { cache } from "react";

export type ClerkOrgMember = {
  userId: string;
  name: string;
  imageUrl: string;
  email: string | null;
};

const getMemberName = (member: {
  firstName?: string | null;
  lastName?: string | null;
  identifier?: string | null;
}) => {
  const fullName = [member.firstName, member.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || member.identifier || "Thành viên tổ chức";
};

const toClerkOrgMember = (membership: {
  publicUserData?: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string;
    identifier: string;
  } | null;
}): ClerkOrgMember | null => {
  const publicUserData = membership.publicUserData;

  if (!publicUserData?.userId) {
    return null;
  }

  return {
    userId: publicUserData.userId,
    name: getMemberName(publicUserData),
    imageUrl: publicUserData.imageUrl,
    email: publicUserData.identifier || null,
  };
};

export const getOrganizationMembers = cache(async (
  orgId: string,
): Promise<ClerkOrgMember[]> => {
  const client = await clerkClient();
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    limit: 100,
    orderBy: "+first_name",
  });

  return memberships.data
    .map(toClerkOrgMember)
    .filter((member): member is ClerkOrgMember => Boolean(member));
});

export const getOrganizationMember = cache(async (
  orgId: string,
  userId: string,
): Promise<ClerkOrgMember | null> => {
  const client = await clerkClient();
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId: orgId,
    userId: [userId],
    limit: 1,
  });

  return toClerkOrgMember(memberships.data[0]) ?? null;
});

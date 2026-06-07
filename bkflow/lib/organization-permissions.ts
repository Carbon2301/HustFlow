import { auth, clerkClient } from "@clerk/nextjs/server";
import { cache } from "react";

export const ORG_ADMIN_ROLE = "org:admin";
export const ORG_MEMBER_ROLE = "org:member";
export const ORG_ADMIN_REQUIRED_ERROR =
  "Chỉ quản trị viên tổ chức mới có thể quản lý thanh toán.";

export const getCurrentOrganizationMembership = cache(
  async (organizationId: string, userId: string) => {
    const client = await clerkClient();
    const memberships = await client.organizations.getOrganizationMembershipList({
      organizationId,
      userId: [userId],
      limit: 1,
    });

    return memberships.data[0] ?? null;
  },
);

export const isOrganizationAdmin = async (
  organizationId: string,
  userId: string,
) => {
  const membership = await getCurrentOrganizationMembership(organizationId, userId);

  return membership?.role === ORG_ADMIN_ROLE;
};

export const requireOrganizationAdmin = async () => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
      userId: null,
      orgId: null,
      membership: null,
    };
  }

  const membership = await getCurrentOrganizationMembership(orgId, userId);

  if (!membership || membership.role !== ORG_ADMIN_ROLE) {
    return {
      error: ORG_ADMIN_REQUIRED_ERROR,
      userId,
      orgId,
      membership,
    };
  }

  return {
    error: null,
    userId,
    orgId,
    membership,
  };
};

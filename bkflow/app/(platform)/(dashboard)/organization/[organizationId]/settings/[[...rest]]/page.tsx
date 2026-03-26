import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import {
  WorkspaceSettingsClient,
  WorkspaceSettingsInvitation,
  WorkspaceSettingsMember,
} from "../_components/workspace-settings-client";

const ADMIN_ROLE = "org:admin";
const MEMBER_ROLE = "org:member";
const PAGE_SIZE = 100;

type Role = typeof ADMIN_ROLE | typeof MEMBER_ROLE;
type ActiveTab = "general" | "members" | "invitations";

const getName = (member: {
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

const toRole = (role: string): Role =>
  role === ADMIN_ROLE ? ADMIN_ROLE : MEMBER_ROLE;

const toIsoDate = (value: Date | number) => new Date(value).toISOString();

const getInitialTab = (rest?: string[]): ActiveTab => {
  const firstSegment = rest?.[0];

  if (firstSegment === "members" || firstSegment === "invitations") {
    return firstSegment;
  }

  return "general";
};

const fetchAllPages = async <T,>(
  loader: (offset: number) => Promise<{ data: T[]; totalCount: number }>,
) => {
  const items: T[] = [];
  let offset = 0;
  let totalCount = Number.POSITIVE_INFINITY;

  while (offset < totalCount) {
    const page = await loader(offset);
    items.push(...page.data);
    totalCount = page.totalCount;
    offset += PAGE_SIZE;
  }

  return items;
};

const SettingsPage = async ({
  params,
}: {
  params: Promise<{ organizationId: string; rest?: string[] }>;
}) => {
  const { userId } = await auth();
  const { organizationId, rest } = await params;

  if (!userId) {
    redirect("/sign-in");
  }

  const client = await clerkClient();
  const currentMemberships = await client.organizations.getOrganizationMembershipList({
    organizationId,
    userId: [userId],
    limit: 1,
  });
  const currentMembership = currentMemberships.data[0];

  if (!currentMembership) {
    redirect("/select-org");
  }

  const isAdmin = currentMembership.role === ADMIN_ROLE;
  const initialTab = getInitialTab(rest);

  if (initialTab === "invitations" && !isAdmin) {
    redirect(`/organization/${organizationId}/settings/members`);
  }

  const [organization, memberships, invitations, adminMemberships] = await Promise.all([
    client.organizations.getOrganization({
      organizationId,
      includeMembersCount: true,
    }),
    fetchAllPages((offset) =>
      client.organizations.getOrganizationMembershipList({
        organizationId,
        limit: PAGE_SIZE,
        offset,
        orderBy: "+first_name",
      }),
    ),
    isAdmin
      ? fetchAllPages((offset) =>
          client.organizations.getOrganizationInvitationList({
            organizationId,
            status: ["pending"],
            limit: PAGE_SIZE,
            offset,
          }),
        )
      : Promise.resolve([]),
    fetchAllPages((offset) =>
      client.organizations.getOrganizationMembershipList({
        organizationId,
        role: [ADMIN_ROLE],
        limit: PAGE_SIZE,
        offset,
      }),
    ),
  ]);

  const members: WorkspaceSettingsMember[] = memberships
    .map((membership) => {
      const user = membership.publicUserData;

      if (!user?.userId) {
        return null;
      }

      return {
        id: membership.id,
        userId: user.userId,
        name: getName(user),
        email: user.identifier ?? "",
        imageUrl: user.imageUrl,
        role: toRole(membership.role),
        createdAt: toIsoDate(membership.createdAt),
        isCurrentUser: user.userId === userId,
      };
    })
    .filter((member): member is WorkspaceSettingsMember => Boolean(member));

  const pendingInvitations: WorkspaceSettingsInvitation[] = invitations
    .sort((left, right) => Number(right.createdAt) - Number(left.createdAt))
    .map((invitation) => ({
      id: invitation.id,
      emailAddress: invitation.emailAddress,
      role: toRole(invitation.role),
      createdAt: toIsoDate(invitation.createdAt),
    }));

  return (
    <WorkspaceSettingsClient
      organization={{
        id: organization.id,
        name: organization.name,
        imageUrl: organization.imageUrl,
        maxAllowedMemberships: organization.maxAllowedMemberships,
      }}
      initialTab={initialTab}
      currentUserId={userId}
      currentRole={toRole(currentMembership.role)}
      adminCount={adminMemberships.length}
      members={members}
      invitations={pendingInvitations}
    />
  );
};

export default SettingsPage;

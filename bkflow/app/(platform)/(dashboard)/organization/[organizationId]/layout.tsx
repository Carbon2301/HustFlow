import { auth, clerkClient } from "@clerk/nextjs/server";

import { OrgControl } from "./_components/org-control";

export async function generateMetadata({
  params,
}: {
  params: { organizationId: string };
}) {
  const { orgId } = await auth();
  const organizationId = params.organizationId || orgId;

  if (!organizationId) {
    return { title: "Organization" };
  }

  try {
    const client = await clerkClient();
    const organization = await client.organizations.getOrganization({
      organizationId,
    });

    return { title: organization.name || "Organization" };
  } catch {
    return { title: "Organization" };
  }
};

const OrganizationIdLayout = ({
  children
}: {
  children: React.ReactNode;
}) => {
  return (
    <>
      <OrgControl />
      {children}
    </>
  );
};

export default OrganizationIdLayout;
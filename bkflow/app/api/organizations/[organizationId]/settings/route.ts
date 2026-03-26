import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_ROLE = "org:admin";
const MEMBER_ROLE = "org:member";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MANAGE_ACTIONS = new Set([
  "deleteOrganization",
  "invite",
  "removeMember",
  "revokeInvitation",
  "updateMemberRole",
]);

type ErrorWithClerkPayload = {
  status?: number;
  errors?: Array<{
    longMessage?: string;
    message?: string;
    code?: string;
  }>;
  message?: string;
};

const getApiError = (error: unknown) => {
  if (typeof error === "object" && error !== null) {
    const clerkError = error as ErrorWithClerkPayload;
    const firstError = clerkError.errors?.[0];
    const message =
      firstError?.longMessage ||
      firstError?.message ||
      clerkError.message ||
      "Có lỗi xảy ra. Vui lòng thử lại.";

    return {
      message,
      status: clerkError.status && clerkError.status >= 400 ? clerkError.status : 400,
    };
  }

  return {
    message: "Có lỗi xảy ra. Vui lòng thử lại.",
    status: 500,
  };
};

const getAdminMemberships = async (organizationId: string) => {
  const client = await clerkClient();

  return client.organizations.getOrganizationMembershipList({
    organizationId,
    limit: 100,
    role: [ADMIN_ROLE],
  });
};

const getCurrentMembership = async (organizationId: string, userId: string) => {
  const client = await clerkClient();
  const memberships = await client.organizations.getOrganizationMembershipList({
    organizationId,
    userId: [userId],
    limit: 1,
  });

  return memberships.data[0] ?? null;
};

const requireOrganizationMember = async (organizationId: string) => {
  const { userId } = await auth();

  if (!userId) {
    return { error: new NextResponse("Unauthorized", { status: 401 }) };
  }

  const currentMembership = await getCurrentMembership(organizationId, userId);

  if (!currentMembership) {
    return { error: new NextResponse("Forbidden", { status: 403 }) };
  }

  return { userId, currentMembership };
};

const isLastAdmin = async (organizationId: string, userId: string) => {
  const admins = await getAdminMemberships(organizationId);

  return (
    admins.totalCount <= 1 &&
    admins.data.some((membership) => membership.publicUserData?.userId === userId)
  );
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const authResult = await requireOrganizationMember(organizationId);

    if ("error" in authResult) {
      return authResult.error;
    }

    const { userId, currentMembership } = authResult;
    const formData = await req.formData();
    const name = String(formData.get("name") ?? "").trim();
    const logo = formData.get("logo");
    const client = await clerkClient();

    if (currentMembership.role !== ADMIN_ROLE) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!name) {
      return new NextResponse("Tên không được để trống", { status: 400 });
    }

    await client.organizations.updateOrganization(organizationId, { name });

    if (logo instanceof File && logo.size > 0) {
      await client.organizations.updateOrganizationLogo(organizationId, {
        file: logo,
        uploaderUserId: userId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ORGANIZATION_SETTINGS_PATCH_ERROR]", error);
    const apiError = getApiError(error);

    return new NextResponse(apiError.message, { status: apiError.status });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await params;
    const authResult = await requireOrganizationMember(organizationId);

    if ("error" in authResult) {
      return authResult.error;
    }

    const { userId, currentMembership } = authResult;
    const body = await req.json();
    const action = String(body.action ?? "");
    const client = await clerkClient();

    if (MANAGE_ACTIONS.has(action) && currentMembership.role !== ADMIN_ROLE) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (action === "leave") {
      if (
        currentMembership.role === ADMIN_ROLE &&
        (await isLastAdmin(organizationId, userId))
      ) {
        return new NextResponse("Quản trị viên duy nhất không thể rời tổ chức", {
          status: 400,
        });
      }

      await client.organizations.deleteOrganizationMembership({
        organizationId,
        userId,
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "deleteOrganization") {
      await client.organizations.deleteOrganization(organizationId);

      return NextResponse.json({ ok: true });
    }

    if (action === "invite") {
      const emailAddress = String(body.emailAddress ?? "").trim();
      const role = body.role === ADMIN_ROLE ? ADMIN_ROLE : MEMBER_ROLE;

      if (!emailAddress) {
        return new NextResponse("Email không được để trống", { status: 400 });
      }

      if (!EMAIL_PATTERN.test(emailAddress)) {
        return new NextResponse("Email không hợp lệ. Vui lòng nhập đúng định dạng email.", {
          status: 400,
        });
      }

      await client.organizations.createOrganizationInvitation({
        organizationId,
        emailAddress,
        role,
        inviterUserId: userId,
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "updateMemberRole") {
      const targetUserId = String(body.userId ?? "");
      const role = body.role === ADMIN_ROLE ? ADMIN_ROLE : MEMBER_ROLE;

      if (!targetUserId) {
        return new NextResponse("Thiếu thành viên", { status: 400 });
      }

      if (role !== ADMIN_ROLE && (await isLastAdmin(organizationId, targetUserId))) {
        return new NextResponse("Không thể hạ quyền quản trị viên cuối cùng", {
          status: 400,
        });
      }

      await client.organizations.updateOrganizationMembership({
        organizationId,
        userId: targetUserId,
        role,
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "removeMember") {
      const targetUserId = String(body.userId ?? "");

      if (!targetUserId) {
        return new NextResponse("Thiếu thành viên", { status: 400 });
      }

      if (await isLastAdmin(organizationId, targetUserId)) {
        return new NextResponse("Không thể xóa quản trị viên cuối cùng", {
          status: 400,
        });
      }

      await client.organizations.deleteOrganizationMembership({
        organizationId,
        userId: targetUserId,
      });

      return NextResponse.json({ ok: true });
    }

    if (action === "revokeInvitation") {
      const invitationId = String(body.invitationId ?? "");

      if (!invitationId) {
        return new NextResponse("Thiếu lời mời", { status: 400 });
      }

      await client.organizations.revokeOrganizationInvitation({
        organizationId,
        invitationId,
        requestingUserId: userId,
      });

      return NextResponse.json({ ok: true });
    }

    return new NextResponse("Bad Request", { status: 400 });
  } catch (error) {
    console.error("[ORGANIZATION_SETTINGS_POST_ERROR]", error);
    const apiError = getApiError(error);

    return new NextResponse(apiError.message, { status: apiError.status });
  }
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type {
  ActiveTab,
  Role,
  WorkspaceSettingsClientProps,
  WorkspaceSettingsInvitation,
  WorkspaceSettingsMember,
} from "../_types";
import { ADMIN_ROLE, EMAIL_PATTERN, MEMBER_ROLE } from "../_types";
import { filterMembers, getErrorMessage, getSettingsHref } from "../_lib/settings-utils";
import { DangerZonePanel } from "./danger-zone-panel";
import { InvitationsSettingsPanel } from "./invitations-settings-panel";
import { MemberSettingsPanel } from "./member-settings-panel";
import { ProfileSettingsPanel } from "./profile-settings-panel";
import { SettingsTabs } from "./settings-tabs";

export type {
  WorkspaceSettingsInvitation,
  WorkspaceSettingsMember,
} from "../_types";

export const WorkspaceSettingsClient = ({
  organization,
  initialTab,
  currentRole,
  currentUserId,
  adminCount,
  members,
  invitations,
}: WorkspaceSettingsClientProps) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [query, setQuery] = useState("");
  const [profileName, setProfileName] = useState(organization.name);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>(MEMBER_ROLE);
  const [profilePending, startProfileTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const logoPreviewUrl = useMemo(() => {
    if (!logoFile) {
      return organization.imageUrl;
    }

    return URL.createObjectURL(logoFile);
  }, [logoFile, organization.imageUrl]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const isAdmin = currentRole === ADMIN_ROLE;
  const currentMember = members.find((member) => member.userId === currentUserId);
  const isOnlyAdmin = currentMember?.role === ADMIN_ROLE && adminCount <= 1;
  const usedSeats = members.length + invitations.length;
  const maxSeats = organization.maxAllowedMemberships;

  const filteredMembers = useMemo(
    () => filterMembers(members, query),
    [members, query],
  );

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    router.push(getSettingsHref(organization.id, tab));
  };

  const submitProfile = () => {
    startProfileTransition(async () => {
      const formData = new FormData();
      formData.append("name", profileName);

      if (logoFile) {
        formData.append("logo", logoFile);
      }

      const response = await fetch(`/api/organizations/${organization.id}/settings`, {
        method: "PATCH",
        body: formData,
      });

      if (!response.ok) {
        toast.error(await getErrorMessage(response));
        return;
      }

      toast.success("Đã cập nhật hồ sơ tổ chức");
      setLogoFile(null);
      router.refresh();
    });
  };

  const runAction = (
    body: Record<string, string>,
    successMessage: string,
    redirectTo?: string,
  ) =>
    new Promise<boolean>((resolve) => {
      startActionTransition(async () => {
        const response = await fetch(`/api/organizations/${organization.id}/settings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          toast.error(await getErrorMessage(response));
          resolve(false);
          return;
        }

        toast.success(successMessage);

        if (redirectTo) {
          router.push(redirectTo);
          resolve(true);
          return;
        }

        router.refresh();
        resolve(true);
      });
    });

  const inviteMember = async () => {
    const normalizedEmail = inviteEmail.trim();

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      toast.error("Email không hợp lệ. Vui lòng nhập đúng định dạng email.");
      return;
    }

    const success = await runAction(
      {
        action: "invite",
        emailAddress: normalizedEmail,
        role: inviteRole,
      },
      "Đã gửi lời mời",
    );

    if (success) {
      setInviteEmail("");
      setInviteRole(MEMBER_ROLE);
      setInviteDialogOpen(false);
    }
  };

  const updateMemberRole = (member: WorkspaceSettingsMember, role: Role) =>
    runAction(
      {
        action: "updateMemberRole",
        userId: member.userId,
        role,
      },
      "Đã cập nhật vai trò",
    );

  const removeMember = (member: WorkspaceSettingsMember) =>
    runAction(
      {
        action: "removeMember",
        userId: member.userId,
      },
      "Đã xóa thành viên",
    );

  const revokeInvitation = (invitation: WorkspaceSettingsInvitation) =>
    runAction(
      {
        action: "revokeInvitation",
        invitationId: invitation.id,
      },
      "Đã hủy lời mời",
    );

  return (
    <div className="w-full pb-12">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-violet-700">Không gian làm việc</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-950">
            Cài đặt không gian làm việc
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Quản lý hồ sơ, thành viên và lời mời của {organization.name}.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 shadow-sm">
          <Image
            src={organization.imageUrl}
            alt={organization.name}
            width={36}
            height={36}
            className="rounded-lg object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-neutral-900">
              {organization.name}
            </p>
            <p className="text-xs text-neutral-500">
              {usedSeats} / {maxSeats} thành viên và lời mời
            </p>
          </div>
        </div>
      </div>

      <SettingsTabs
        activeTab={activeTab}
        membersCount={members.length}
        invitationsCount={invitations.length}
        isAdmin={isAdmin}
        onSelectTab={selectTab}
      />

      {activeTab === "general" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <ProfileSettingsPanel
            organization={organization}
            isAdmin={isAdmin}
            profilePending={profilePending}
            profileName={profileName}
            logoPreviewUrl={logoPreviewUrl}
            fileInputRef={fileInputRef}
            onProfileNameChange={setProfileName}
            onLogoFileChange={setLogoFile}
            onSubmitProfile={submitProfile}
          />

          <DangerZonePanel
            isAdmin={isAdmin}
            isOnlyAdmin={isOnlyAdmin}
            actionPending={actionPending}
            onLeave={() =>
              runAction({ action: "leave" }, "Đã rời tổ chức", "/select-org")
            }
            onDeleteOrganization={() =>
              runAction(
                { action: "deleteOrganization" },
                "Đã xóa tổ chức",
                "/select-org",
              )
            }
          />
        </div>
      )}

      {activeTab === "members" && (
        <MemberSettingsPanel
          query={query}
          filteredMembers={filteredMembers}
          isAdmin={isAdmin}
          adminCount={adminCount}
          actionPending={actionPending}
          onQueryChange={setQuery}
          onRoleChange={updateMemberRole}
          onRemove={removeMember}
        />
      )}

      {activeTab === "invitations" && isAdmin && (
        <InvitationsSettingsPanel
          invitations={invitations}
          inviteDialogOpen={inviteDialogOpen}
          inviteEmail={inviteEmail}
          inviteRole={inviteRole}
          actionPending={actionPending}
          onInviteDialogOpenChange={setInviteDialogOpen}
          onInviteEmailChange={setInviteEmail}
          onInviteRoleChange={setInviteRole}
          onInviteMember={inviteMember}
          onRevokeInvitation={revokeInvitation}
        />
      )}
    </div>
  );
};

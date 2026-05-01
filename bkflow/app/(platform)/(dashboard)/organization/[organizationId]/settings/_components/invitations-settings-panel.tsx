"use client";

import { Mail, Trash2 } from "lucide-react";

import type { WorkspaceSettingsInvitation } from "../_types";
import { formatDate, roleLabels } from "../_lib/settings-utils";
import { ConfirmButton } from "./settings-controls";
import { InviteMemberDialog } from "./invite-member-dialog";
import type { Role } from "../_types";

export const InvitationsSettingsPanel = ({
  invitations,
  inviteDialogOpen,
  inviteEmail,
  inviteRole,
  actionPending,
  onInviteDialogOpenChange,
  onInviteEmailChange,
  onInviteRoleChange,
  onInviteMember,
  onRevokeInvitation,
}: {
  invitations: WorkspaceSettingsInvitation[];
  inviteDialogOpen: boolean;
  inviteEmail: string;
  inviteRole: Role;
  actionPending: boolean;
  onInviteDialogOpenChange: (open: boolean) => void;
  onInviteEmailChange: (email: string) => void;
  onInviteRoleChange: (role: Role) => void;
  onInviteMember: () => void;
  onRevokeInvitation: (invitation: WorkspaceSettingsInvitation) => Promise<boolean>;
}) => (
  <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-neutral-950">Lời mời</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Theo dõi và hủy các lời mời đang chờ phản hồi.
        </p>
      </div>
      <InviteMemberDialog
        open={inviteDialogOpen}
        email={inviteEmail}
        role={inviteRole}
        actionPending={actionPending}
        onOpenChange={onInviteDialogOpenChange}
        onEmailChange={onInviteEmailChange}
        onRoleChange={onInviteRoleChange}
        onSubmit={onInviteMember}
      />
    </div>
    <div className="divide-y divide-neutral-100">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-neutral-400" />
              <p className="truncate font-medium text-neutral-900">
                {invitation.emailAddress}
              </p>
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              {roleLabels[invitation.role]} · Mời ngày {formatDate(invitation.createdAt)}
            </p>
          </div>
          <ConfirmButton
            disabled={actionPending}
            title="Hủy lời mời?"
            description={`Lời mời tới ${invitation.emailAddress} sẽ bị hủy.`}
            buttonLabel="Hủy lời mời"
            confirmLabel="Hủy lời mời"
            icon={Trash2}
            variant="destructive"
            onConfirm={() => onRevokeInvitation(invitation)}
          />
        </div>
      ))}
      {invitations.length === 0 && (
        <div className="px-4 py-8 text-center text-sm text-neutral-500">
          Chưa có lời mời nào đang chờ.
        </div>
      )}
    </div>
  </section>
);

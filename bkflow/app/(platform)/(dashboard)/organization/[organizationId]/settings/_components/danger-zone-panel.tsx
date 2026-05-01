"use client";

import { LogOut, Trash2 } from "lucide-react";

import { ConfirmButton } from "./settings-controls";

export const DangerZonePanel = ({
  isAdmin,
  isOnlyAdmin,
  actionPending,
  onLeave,
  onDeleteOrganization,
}: {
  isAdmin: boolean;
  isOnlyAdmin: boolean;
  actionPending: boolean;
  onLeave: () => Promise<boolean>;
  onDeleteOrganization: () => Promise<boolean>;
}) => (
  <section className="space-y-4">
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-neutral-950">
        Rời tổ chức
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Bạn sẽ mất quyền truy cập vào các bảng trong tổ chức này.
      </p>
      {!isOnlyAdmin && (
        <ConfirmButton
          className="mt-4"
          disabled={actionPending}
          title="Rời tổ chức?"
          description="Bạn có chắc muốn rời tổ chức này không?"
          buttonLabel="Rời tổ chức"
          confirmLabel="Rời tổ chức"
          icon={LogOut}
          variant="destructive"
          onConfirm={onLeave}
        />
      )}
      {isOnlyAdmin && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Bạn là quản trị viên duy nhất nên không thể rời tổ chức.
        </p>
      )}
    </div>

    {isAdmin && (
      <div className="rounded-lg border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-red-700">
          Xóa tổ chức
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Hành động này xóa tổ chức khỏi Clerk và không thể hoàn tác.
        </p>
        <ConfirmButton
          className="mt-4"
          disabled={actionPending}
          title="Xóa tổ chức?"
          description="Tổ chức và quyền truy cập liên quan sẽ bị xóa vĩnh viễn."
          buttonLabel="Xóa tổ chức"
          confirmLabel="Xóa tổ chức"
          icon={Trash2}
          variant="destructive"
          onConfirm={onDeleteOrganization}
        />
      </div>
    )}
  </section>
);

"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

import type { Role, WorkspaceSettingsMember } from "../_types";
import { ADMIN_ROLE } from "../_types";
import { MemberRow } from "./member-row";

export const MemberSettingsPanel = ({
  query,
  filteredMembers,
  isAdmin,
  adminCount,
  actionPending,
  onQueryChange,
  onRoleChange,
  onRemove,
}: {
  query: string;
  filteredMembers: WorkspaceSettingsMember[];
  isAdmin: boolean;
  adminCount: number;
  actionPending: boolean;
  onQueryChange: (query: string) => void;
  onRoleChange: (member: WorkspaceSettingsMember, role: Role) => Promise<boolean>;
  onRemove: (member: WorkspaceSettingsMember) => Promise<boolean>;
}) => (
  <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
    <div className="flex flex-col gap-4 border-b border-neutral-100 p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-base font-semibold text-neutral-950">
          Thành viên
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Tất cả thành viên đều có thể tìm kiếm trong danh sách này.
        </p>
      </div>
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-neutral-400" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Tìm theo tên, email hoặc vai trò"
          className="pl-8"
        />
      </div>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-left text-xs font-medium uppercase text-neutral-500">
            <th className="px-4 py-3">Người dùng</th>
            <th className="px-4 py-3">Ngày tham gia</th>
            <th className="px-4 py-3">Vai trò</th>
            {isAdmin && <th className="px-4 py-3 text-right">Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isAdmin={isAdmin}
              actionPending={actionPending}
              isLastAdmin={member.role === ADMIN_ROLE && adminCount <= 1}
              onRoleChange={(role) => onRoleChange(member, role)}
              onRemove={() => onRemove(member)}
            />
          ))}
          {filteredMembers.length === 0 && (
            <tr>
              <td
                colSpan={isAdmin ? 4 : 3}
                className="px-4 py-8 text-center text-sm text-neutral-500"
              >
                Không tìm thấy thành viên phù hợp.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
);

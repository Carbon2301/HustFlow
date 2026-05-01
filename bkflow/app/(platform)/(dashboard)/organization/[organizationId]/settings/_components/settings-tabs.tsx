"use client";

import type { LucideIcon } from "lucide-react";
import { Building2, Mail, Users } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ActiveTab } from "../_types";

const TabButton = ({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition",
      active
        ? "border-violet-600 text-violet-700"
        : "border-transparent text-neutral-500 hover:text-neutral-900",
    )}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

export const SettingsTabs = ({
  activeTab,
  membersCount,
  invitationsCount,
  isAdmin,
  onSelectTab,
}: {
  activeTab: ActiveTab;
  membersCount: number;
  invitationsCount: number;
  isAdmin: boolean;
  onSelectTab: (tab: ActiveTab) => void;
}) => (
  <div className="mb-5 flex flex-wrap gap-2 border-b border-neutral-200">
    <TabButton
      active={activeTab === "general"}
      icon={Building2}
      label="Chung"
      onClick={() => onSelectTab("general")}
    />
    <TabButton
      active={activeTab === "members"}
      icon={Users}
      label={`Thành viên (${membersCount})`}
      onClick={() => onSelectTab("members")}
    />
    {isAdmin && (
      <TabButton
        active={activeTab === "invitations"}
        icon={Mail}
        label={`Lời mời (${invitationsCount})`}
        onClick={() => onSelectTab("invitations")}
      />
    )}
  </div>
);

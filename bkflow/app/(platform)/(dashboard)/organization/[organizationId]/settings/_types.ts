"use client";

export const ADMIN_ROLE = "org:admin";
export const MEMBER_ROLE = "org:member";
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Role = typeof ADMIN_ROLE | typeof MEMBER_ROLE;
export type ActiveTab = "general" | "members" | "invitations";

export type WorkspaceSettingsMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  imageUrl: string;
  role: Role;
  createdAt: string;
  isCurrentUser: boolean;
};

export type WorkspaceSettingsInvitation = {
  id: string;
  emailAddress: string;
  role: Role;
  createdAt: string;
};

export type WorkspaceSettingsOrganization = {
  id: string;
  name: string;
  imageUrl: string;
  maxAllowedMemberships: number;
};

export type WorkspaceSettingsClientProps = {
  organization: WorkspaceSettingsOrganization;
  initialTab: ActiveTab;
  currentUserId: string;
  currentRole: Role;
  adminCount: number;
  members: WorkspaceSettingsMember[];
  invitations: WorkspaceSettingsInvitation[];
};

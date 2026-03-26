"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  Camera,
  ChevronDown,
  Loader2,
  LogOut,
  Mail,
  MoreHorizontal,
  Search,
  Send,
  Shield,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ADMIN_ROLE = "org:admin";
const MEMBER_ROLE = "org:member";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Role = typeof ADMIN_ROLE | typeof MEMBER_ROLE;
type ActiveTab = "general" | "members" | "invitations";
type ConfirmIcon = typeof LogOut;

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

type WorkspaceSettingsClientProps = {
  organization: {
    id: string;
    name: string;
    imageUrl: string;
    maxAllowedMemberships: number;
  };
  initialTab: ActiveTab;
  currentUserId: string;
  currentRole: Role;
  adminCount: number;
  members: WorkspaceSettingsMember[];
  invitations: WorkspaceSettingsInvitation[];
};

const roleLabels: Record<Role, string> = {
  [ADMIN_ROLE]: "Quản trị viên",
  [MEMBER_ROLE]: "Thành viên",
};
const availableRoles: Role[] = [MEMBER_ROLE, ADMIN_ROLE];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

const getInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getErrorMessage = async (response: Response) => {
  const text = await response.text();

  return text || "Có lỗi xảy ra. Vui lòng thử lại.";
};

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

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return members;
    }

    return members.filter((member) =>
      [member.name, member.email, roleLabels[member.role]]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [members, query]);

  const getSettingsHref = (tab: ActiveTab) => {
    const suffix = tab === "general" ? "" : `/${tab}`;

    return `/organization/${organization.id}/settings${suffix}`;
  };

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    router.push(getSettingsHref(tab));
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

      <div className="mb-5 flex flex-wrap gap-2 border-b border-neutral-200">
        <TabButton
          active={activeTab === "general"}
          icon={Building2}
          label="Chung"
          onClick={() => selectTab("general")}
        />
        <TabButton
          active={activeTab === "members"}
          icon={Users}
          label={`Thành viên (${members.length})`}
          onClick={() => selectTab("members")}
        />
        {isAdmin && (
          <TabButton
            active={activeTab === "invitations"}
            icon={Mail}
            label={`Lời mời (${invitations.length})`}
            onClick={() => selectTab("invitations")}
          />
        )}
      </div>

      {activeTab === "general" && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-950">
                  Hồ sơ tổ chức
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Cập nhật tên và ảnh đại diện hiển thị trong HustFlow.
                </p>
              </div>
              {isAdmin && (
                <Button
                  disabled={profilePending}
                  onClick={submitProfile}
                  variant="primary"
                >
                  {profilePending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Lưu thay đổi
                </Button>
              )}
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-[160px_minmax(0,1fr)]">
              <div>
                <Label>Ảnh đại diện</Label>
                <div className="mt-2 flex flex-col items-start gap-3">
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => fileInputRef.current?.click()}
                    className="relative h-24 w-24 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 disabled:cursor-default"
                  >
                    <Image
                      src={logoPreviewUrl}
                      alt={organization.name}
                      fill
                      unoptimized={logoPreviewUrl.startsWith("blob:")}
                      className="object-cover"
                    />
                    {isAdmin && (
                      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-1.5 text-xs font-medium text-white">
                        <Camera className="h-3 w-3" />
                        Đổi ảnh
                      </span>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="workspace-name">Tên tổ chức</Label>
                <Input
                  id="workspace-name"
                  value={profileName}
                  disabled={!isAdmin || profilePending}
                  onChange={(event) => setProfileName(event.target.value)}
                  className="mt-2 max-w-xl"
                />
                {!isAdmin && (
                  <p className="mt-2 text-sm text-neutral-500">
                    Chỉ quản trị viên mới có thể chỉnh sửa hồ sơ tổ chức.
                  </p>
                )}
              </div>
            </div>
          </section>

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
                  onConfirm={() =>
                    runAction({ action: "leave" }, "Đã rời tổ chức", "/select-org")
                  }
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
                  onConfirm={() =>
                    runAction(
                      { action: "deleteOrganization" },
                      "Đã xóa tổ chức",
                      "/select-org",
                    )
                  }
                />
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "members" && (
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
                onChange={(event) => setQuery(event.target.value)}
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
                    onRoleChange={(role) =>
                      runAction(
                        {
                          action: "updateMemberRole",
                          userId: member.userId,
                          role,
                        },
                        "Đã cập nhật vai trò",
                      )
                    }
                    onRemove={() =>
                      runAction(
                        {
                          action: "removeMember",
                          userId: member.userId,
                        },
                        "Đã xóa thành viên",
                      )
                    }
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
      )}

      {activeTab === "invitations" && isAdmin && (
        <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-neutral-100 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-neutral-950">Lời mời</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Theo dõi và hủy các lời mời đang chờ phản hồi.
              </p>
            </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="primary">
                  <Send className="h-4 w-4" />
                  Mời
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mời thành viên</DialogTitle>
                  <DialogDescription>
                    Gửi lời mời tham gia tổ chức qua email.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="ten@example.com"
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Vai trò</Label>
                    <RolePicker value={inviteRole} onChange={setInviteRole} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    disabled={actionPending || !inviteEmail.trim()}
                    onClick={inviteMember}
                    variant="primary"
                  >
                    {actionPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Gửi lời mời
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                  onConfirm={() =>
                    runAction(
                      {
                        action: "revokeInvitation",
                        invitationId: invitation.id,
                      },
                      "Đã hủy lời mời",
                    )
                  }
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
      )}
    </div>
  );
};

const TabButton = ({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof Building2;
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

const RoleBadge = ({ role }: { role: Role }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium",
      role === ADMIN_ROLE
        ? "bg-violet-50 text-violet-700"
        : "bg-neutral-100 text-neutral-700",
    )}
  >
    {role === ADMIN_ROLE && <Shield className="h-3 w-3" />}
    {roleLabels[role]}
  </span>
);

const RolePicker = ({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className="mt-2 w-full justify-between"
      >
        {roleLabels[value]}
        <ChevronDown className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-56">
      {availableRoles.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => onChange(role)}
          className={cn(
            "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-neutral-100",
            value === role && "bg-neutral-100 font-medium",
          )}
        >
          {roleLabels[role]}
        </button>
      ))}
    </PopoverContent>
  </Popover>
);

const MemberRow = ({
  member,
  isAdmin,
  isLastAdmin,
  actionPending,
  onRoleChange,
  onRemove,
}: {
  member: WorkspaceSettingsMember;
  isAdmin: boolean;
  isLastAdmin: boolean;
  actionPending: boolean;
  onRoleChange: (role: Role) => void;
  onRemove: () => Promise<boolean>;
}) => {
  const roleDisabled = actionPending || isLastAdmin;

  return (
    <tr className="border-b border-neutral-100 last:border-0">
      <td className="px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={member.imageUrl} alt={member.name} />
            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-neutral-900">{member.name}</p>
              {member.isCurrentUser && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                  Bạn
                </span>
              )}
            </div>
            <p className="truncate text-xs text-neutral-500">{member.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-neutral-600">{formatDate(member.createdAt)}</td>
      <td className="px-4 py-3">
        {isAdmin ? (
          <RolePicker value={member.role} onChange={onRoleChange} disabled={roleDisabled} />
        ) : (
          <RoleBadge role={member.role} />
        )}
      </td>
      {isAdmin && (
        <td className="px-4 py-3 text-right">
          {!isLastAdmin && (
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon-sm" variant="ghost" disabled={actionPending}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52">
                <ConfirmButton
                  asMenuItem
                  disabled={actionPending}
                  title="Xóa thành viên?"
                  description={`${member.name} sẽ bị xóa khỏi tổ chức.`}
                  buttonLabel="Xóa thành viên"
                  confirmLabel="Xóa thành viên"
                  icon={UserMinus}
                  variant="destructive"
                  onConfirm={onRemove}
                />
              </PopoverContent>
            </Popover>
          )}
        </td>
      )}
    </tr>
  );
};

const ConfirmButton = ({
  title,
  description,
  buttonLabel,
  confirmLabel,
  icon: Icon,
  variant,
  className,
  disabled,
  asMenuItem = false,
  onConfirm,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  confirmLabel: string;
  icon: ConfirmIcon;
  variant: "destructive" | "primary";
  className?: string;
  disabled?: boolean;
  asMenuItem?: boolean;
  onConfirm: () => Promise<boolean> | boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    const success = await onConfirm();
    setConfirming(false);

    if (success) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {asMenuItem ? (
          <button
            type="button"
            disabled={disabled}
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon className="h-4 w-4" />
            {buttonLabel}
          </button>
        ) : (
          <Button className={className} disabled={disabled} variant={variant}>
            <Icon className="h-4 w-4" />
            {buttonLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            disabled={disabled || confirming}
            onClick={handleConfirm}
            variant={variant}
          >
            {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

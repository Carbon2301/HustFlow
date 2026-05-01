"use client";

import Image from "next/image";
import type { RefObject } from "react";
import { Camera, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { WorkspaceSettingsOrganization } from "../_types";

export const ProfileSettingsPanel = ({
  organization,
  isAdmin,
  profilePending,
  profileName,
  logoPreviewUrl,
  fileInputRef,
  onProfileNameChange,
  onLogoFileChange,
  onSubmitProfile,
}: {
  organization: WorkspaceSettingsOrganization;
  isAdmin: boolean;
  profilePending: boolean;
  profileName: string;
  logoPreviewUrl: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onProfileNameChange: (name: string) => void;
  onLogoFileChange: (file: File | null) => void;
  onSubmitProfile: () => void;
}) => (
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
          onClick={onSubmitProfile}
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
            onChange={(event) => onLogoFileChange(event.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="workspace-name">Tên tổ chức</Label>
        <Input
          id="workspace-name"
          value={profileName}
          disabled={!isAdmin || profilePending}
          onChange={(event) => onProfileNameChange(event.target.value)}
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
);

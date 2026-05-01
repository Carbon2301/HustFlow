"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Loader2, Shield } from "lucide-react";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { Role } from "../_types";
import { ADMIN_ROLE } from "../_types";
import { availableRoles, roleLabels } from "../_lib/settings-utils";

export const RoleBadge = ({ role }: { role: Role }) => (
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

export const RolePicker = ({
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

export const ConfirmButton = ({
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
  icon: LucideIcon;
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

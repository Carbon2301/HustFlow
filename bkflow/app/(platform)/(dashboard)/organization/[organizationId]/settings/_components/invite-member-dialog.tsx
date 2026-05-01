"use client";

import { Loader2, Send } from "lucide-react";

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

import type { Role } from "../_types";
import { RolePicker } from "./settings-controls";

export const InviteMemberDialog = ({
  open,
  email,
  role,
  actionPending,
  onOpenChange,
  onEmailChange,
  onRoleChange,
  onSubmit,
}: {
  open: boolean;
  email: string;
  role: Role;
  actionPending: boolean;
  onOpenChange: (open: boolean) => void;
  onEmailChange: (email: string) => void;
  onRoleChange: (role: Role) => void;
  onSubmit: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
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
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="ten@example.com"
            className="mt-2"
          />
        </div>
        <div>
          <Label>Vai trò</Label>
          <RolePicker value={role} onChange={onRoleChange} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={actionPending || !email.trim()}
          onClick={onSubmit}
          variant="primary"
        >
          {actionPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Gửi lời mời
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

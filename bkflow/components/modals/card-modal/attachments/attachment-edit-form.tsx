"use client";

import { AttachmentType, type CardAttachment } from "@prisma/client";
import { X } from "lucide-react";

import type { InputType as UpdateCardAttachmentInput } from "@/actions/attachments/update-card-attachment/types";
import { FormInput } from "@/components/form/form-input";
import { FormSubmit } from "@/components/form/form-submit";
import { Button } from "@/components/ui/button";
import type { FieldErrors } from "@/lib/create-safe-action";

interface AttachmentEditFormProps {
  item: CardAttachment;
  isUpdating: boolean;
  fieldErrors: FieldErrors<UpdateCardAttachmentInput> | undefined;
  onUpdate: (formData: FormData, item: CardAttachment) => void;
  onCancel: () => void;
}

export const AttachmentEditForm = ({
  item,
  isUpdating,
  fieldErrors,
  onUpdate,
  onCancel,
}: AttachmentEditFormProps) => {
  if (item.type === AttachmentType.LINK) {
    return (
      <form
        action={(formData) => onUpdate(formData, item)}
        className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <FormInput
          id="url"
          type="text"
          label="URL"
          defaultValue={item.url}
          placeholder="https://example.com"
          disabled={isUpdating}
          errors={fieldErrors}
          className="h-9 rounded-lg bg-white"
        />
        <FormInput
          id="name"
          label="Tên hiển thị"
          defaultValue={item.name}
          placeholder="Tùy chọn"
          disabled={isUpdating}
          errors={fieldErrors}
          className="h-9 rounded-lg bg-white"
        />
        <div className="flex items-center gap-x-2">
          <FormSubmit
            disabled={isUpdating}
            className="h-8 rounded-lg px-3 text-xs"
          >
            {isUpdating ? "Đang lưu..." : "Lưu"}
          </FormSubmit>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-neutral-500"
            disabled={isUpdating}
            onClick={onCancel}
          >
            <X className="h-3.5 w-3.5" />
            Hủy
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      action={(formData) => onUpdate(formData, item)}
      className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-white p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <FormInput
        id="name"
        label="Tên file"
        defaultValue={item.name}
        placeholder="Tên file"
        disabled={isUpdating}
        errors={fieldErrors}
        className="h-9 rounded-lg bg-white"
      />
      <div className="flex items-center gap-x-2">
        <FormSubmit
          disabled={isUpdating}
          className="h-8 rounded-lg px-3 text-xs"
        >
          {isUpdating ? "Đang lưu..." : "Lưu"}
        </FormSubmit>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-neutral-500"
          disabled={isUpdating}
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5" />
          Hủy
        </Button>
      </div>
    </form>
  );
};

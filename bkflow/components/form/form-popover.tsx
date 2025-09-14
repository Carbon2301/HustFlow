"use client";

import { X } from "lucide-react";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { useAction } from "@/hooks/use-action";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { Button } from "@/components/ui/button";
import { createBoard } from "@/actions/create-board";

import { FormInput } from "./form-input";
import { FormSubmit } from "./form-submit";
import { FormPicker } from "./form-picker";
import { useRef } from "react";
import { useRouter } from "next/navigation";

interface FormPopoverProps {
  children: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
  align?: "start" | "center" | "end";
  sideOffset?: number;
};

export const FormPopover = ({
  children,
  side = "bottom",
  align,
  sideOffset = 0,
}: FormPopoverProps) => {
    const router = useRouter();
    const closeRef = useRef<HTMLButtonElement>(null);
    const isMounted = useIsMounted();

    const { execute, fieldErrors } = useAction(createBoard, {
    onSuccess: (data) => {
        toast.success("Board created!");
        closeRef.current?.click();
        router.push(`/board/${data.id}`);
    },
    onError: (error) => {
        toast.error(error);
    }
});

    const onSubmit = (formData: FormData) => {
        const title = formData.get("title") as string;
        const image = formData.get("image") as string;
    execute({ title, image });
  }

  if (!isMounted) {
    return <>{children}</>;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-80 pt-4 pb-4 px-4 shadow-xl rounded-xl border border-neutral-200"
        side={side}
        sideOffset={sideOffset}
      >
        <div className="text-sm font-semibold text-center text-neutral-700 pb-3">
          Create board
        </div>
        <PopoverClose ref={closeRef} asChild>
          <Button
            className="h-7 w-7 p-0 absolute top-3 right-3 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md"
            variant="ghost"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </PopoverClose>
        <form action={onSubmit} className="space-y-4">
          <div className="space-y-3">
            <FormPicker
              id="image"
              errors={fieldErrors}
            />
            <FormInput
              id="title"
              label="Board title"
              type="text"
              errors={fieldErrors}
              className="rounded-lg text-sm"
            />
          </div>
          <FormSubmit className="w-full bg-violet-600 hover:bg-violet-700 text-white rounded-lg h-9 font-medium">
            Create board
          </FormSubmit>
        </form>
      </PopoverContent>
    </Popover>
  );
};

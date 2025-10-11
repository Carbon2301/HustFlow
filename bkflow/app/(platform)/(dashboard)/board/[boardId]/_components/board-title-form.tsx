"use client";

import { toast } from "sonner";
import { useRef, useState, useEffect } from "react";
import { Board } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/form/form-input";
import { updateBoard } from "@/actions/update-board"; 
import { useAction } from "@/hooks/use-action";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";
import { REALTIME_EVENTS } from "@/lib/realtime/events";

interface BoardTitleFormProps {
  data: Board;
  canEdit: boolean;
  currentUserId: string;
};

export const BoardTitleForm = ({
  data,
  canEdit,
  currentUserId,
}: BoardTitleFormProps) => {
  const { execute } = useAction(updateBoard, {
    onSuccess: (data) => {
      toast.success(`Đã cập nhật bảng "${data.title}"!`);
      setTitle(data.title);
      disableEditing();
    },
    onError: (error) => {
      toast.error(error);
    }
  });

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(data.title);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setTitle(data.title);
  }, [data.title]);

  const channelName = realtimeChannels.board(data.id);
  const enabled = isRealtimeClientConfigured();

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.BOARD_UPDATED,
    onEvent: (payload) => {
      if (payload.actorUserId === currentUserId) {
        return;
      }
      if (payload.title) {
        setTitle(payload.title);
      }
    },
    enabled,
  });

  const enableEditing = () => {
    if (!canEdit) {
      return;
    }

    setIsEditing(true);
    setTimeout(() => {
     inputRef.current?.focus();
     inputRef.current?.select(); 
    })
  };

  const disableEditing = () => {
    setIsEditing(false);
  };

  const onSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    
    execute({
      title,
      id: data.id,
    });
  };

  const onBlur = () => {
    formRef.current?.requestSubmit();
  };

  if (isEditing) {
    return (
      <form action={onSubmit} ref={formRef} className="flex items-center gap-x-2">
        <FormInput
          ref={inputRef}
          id="title"
          onBlur={onBlur}
          defaultValue={title}
          className="text-lg font-bold px-[7px] py-1 h-7 bg-transparent focus-visible:bg-white/20 focus-visible:ring-0 focus-visible:border-none border-none rounded-md transition text-white"
        />
      </form>
    )
  }
  
  return (
    <Button
      onClick={enableEditing}
      variant="transparent"
      disabled={!canEdit}
      className="font-bold text-lg h-auto w-auto p-1 px-2"
    >
      {title}
    </Button>
  );
};

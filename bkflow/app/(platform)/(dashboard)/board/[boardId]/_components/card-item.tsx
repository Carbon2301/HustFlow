"use client";

import { Card } from "@prisma/client";
import { Draggable } from "@hello-pangea/dnd";
import { AlignLeft } from "lucide-react";

import { useCardModal } from "@/hooks/use-card-modal";

interface CardItemProps {
  data: Card;
  index: number;
};

export const CardItem = ({
  data,
  index,
}: CardItemProps) => {
  const cardModal = useCardModal();

  return (
    <Draggable draggableId={data.id} index={index}>
      {(provided, snapshot) => (
        <div
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          ref={provided.innerRef}
          role="button"
          onClick={() => cardModal.onOpen(data.id)}
          className={`
            group flex items-start gap-x-2
            border border-transparent
            hover:border-violet-200
            py-2.5 px-3 text-sm
            bg-white rounded-lg
            shadow-sm hover:shadow
            transition-all duration-150
            cursor-pointer
            select-none
            ${snapshot.isDragging ? "shadow-md rotate-1 opacity-90 border-violet-300" : ""}
          `}
        >
          <span className="flex-1 leading-snug text-neutral-700 break-words min-w-0">
            {data.title}
          </span>
          {data.description && (
            <AlignLeft className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-neutral-300 group-hover:text-neutral-400 transition-colors" />
          )}
        </div>
      )}
    </Draggable>
  );
};
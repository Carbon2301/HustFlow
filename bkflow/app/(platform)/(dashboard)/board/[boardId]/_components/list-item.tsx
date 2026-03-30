"use client";

import { memo, useRef, useState } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";

import { cn } from "@/lib/utils";
import { ListWithCards } from "@/types";

import { CardForm } from "./card-form";
import { CardItem } from "./card-item";
import { ListHeader } from "./list-header";

interface ListItemProps {
  data: ListWithCards;
  index: number;
  canEdit: boolean;
};

export const ListItem = memo(function ListItem({
  data,
  index,
  canEdit,
}: ListItemProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  const disableEditing = () => {
    setIsEditing(false);
  };

  const enableEditing = () => {
    if (!canEdit) {
      return;
    }

    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    });
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;

    if (target.closest("input, textarea, select, [contenteditable='true']")) {
      return;
    }

    event.preventDefault();
    if (canEdit) {
      setIsOptionsOpen(true);
    }
  };

  return (
    <Draggable draggableId={data.id} index={index} disableInteractiveElementBlocking isDragDisabled={!canEdit}>
      {(provided, snapshot) => (
        <li
          {...provided.draggableProps}
          ref={provided.innerRef}
          className="shrink-0 h-full w-[272px] select-none"
        >
          <div
            onContextMenu={handleContextMenu}
            className={cn(
              "w-full rounded-xl bg-[#f1f2f4] shadow-sm pb-2 flex flex-col",
              snapshot.isDragging && "shadow-md opacity-95"
            )}
          >
            <div>
              <ListHeader
                onAddCard={enableEditing}
                data={data}
                optionsOpen={isOptionsOpen}
                onOptionsOpenChange={setIsOptionsOpen}
                dragHandleProps={provided.dragHandleProps}
                canEdit={canEdit}
              />
            </div>
            <Droppable droppableId={data.id} type="card">
              {(provided, snapshot) => (
                <ol
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "mx-2 px-0 py-0.5 flex flex-col gap-y-1.5 flex-1",
                    data.cards.length > 0 ? "mt-2" : "mt-0",
                    data.cards.length > 6 &&
                      "max-h-[304px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent",
                    snapshot.isDraggingOver && "bg-violet-50/50 rounded-lg"
                  )}
                >
                  {data.cards.map((card, index) => (
                    <CardItem
                      index={index}
                      key={card.id}
                      data={card}
                      canEdit={canEdit}
                    />
                  ))}
                  {provided.placeholder}
                </ol>
              )}
            </Droppable>
            {canEdit && (
              <CardForm
                listId={data.id}
                ref={textareaRef}
                isEditing={isEditing}
                enableEditing={enableEditing}
                disableEditing={disableEditing}
              />
            )}
          </div>
        </li>
      )}
    </Draggable>
  );
});

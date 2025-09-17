"use client";

import { useRef, useState } from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";

import { cn } from "@/lib/utils";
import { ListWithCards } from "@/types";

import { CardForm } from "./card-form";
import { CardItem } from "./card-item";
import { ListHeader } from "./list-header";

interface ListItemProps {
  data: ListWithCards;
  index: number;
};

export const ListItem = ({
  data,
  index,
}: ListItemProps) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [isEditing, setIsEditing] = useState(false);

  const disableEditing = () => {
    setIsEditing(false);
  };

  const enableEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    });
  };

  return (
    <Draggable draggableId={data.id} index={index}>
      {(provided, snapshot) => (
        <li
          {...provided.draggableProps}
          ref={provided.innerRef}
          className="shrink-0 h-full w-[272px] select-none"
        >
          <div
            className={cn(
              "w-full rounded-xl bg-[#f1f2f4] shadow-sm pb-2 flex flex-col",
              snapshot.isDragging && "shadow-xl opacity-95 rotate-1"
            )}
          >
            <div {...provided.dragHandleProps}>
              <ListHeader
                onAddCard={enableEditing}
                data={data}
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
                    snapshot.isDraggingOver && "bg-violet-50/50 rounded-lg"
                  )}
                >
                  {data.cards.map((card, index) => (
                    <CardItem
                      index={index}
                      key={card.id}
                      data={card}
                    />
                  ))}
                  {provided.placeholder}
                </ol>
              )}
            </Droppable>
            <CardForm
              listId={data.id}
              ref={textareaRef}
              isEditing={isEditing}
              enableEditing={enableEditing}
              disableEditing={disableEditing}
            />
          </div>
        </li>
      )}
    </Draggable>
  );
};
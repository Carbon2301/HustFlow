"use client";

import { useMemo, useRef, useState } from "react";
import type { BoardMember } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { MentionSuggestions } from "./mention-suggestions";
import {
  getMentionStateAtCursor,
  getMentionSuggestionOptions,
  insertMentionSuggestion,
  type MentionSuggestionOption,
} from "./mention-utils";

export const CommentEditor = ({
  placeholder,
  initialValue = "",
  submitLabel,
  isLoading,
  onSubmit,
  onCancel,
  boardMembers = [],
}: {
  placeholder: string;
  initialValue?: string;
  submitLabel: string;
  isLoading: boolean;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  boardMembers?: BoardMember[];
}) => {
  const [content, setContent] = useState(initialValue);
  const trimmedContent = content.trim();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const suggestionOptions = useMemo(
    () => getMentionSuggestionOptions(boardMembers, mentionQuery),
    [boardMembers, mentionQuery],
  );

  const updateMentionState = (value: string, selectionStart: number) => {
    const mentionState = getMentionStateAtCursor(value, selectionStart);

    if (!mentionState) {
      setShowSuggestions(false);
      setMentionTriggerIndex(-1);
      return;
    }

    setShowSuggestions(true);
    setMentionQuery(mentionState.query);
    setMentionTriggerIndex(mentionState.triggerIndex);
    setSelectedIndex(0);
  };

  const insertSuggestion = (option: MentionSuggestionOption) => {
    if (mentionTriggerIndex === -1 || !textareaRef.current) return;

    const { nextContent, nextCursorPosition } = insertMentionSuggestion({
      content,
      cursorPosition: textareaRef.current.selectionStart,
      mentionTriggerIndex,
      tag: option.tag,
    });

    setContent(nextContent);
    setShowSuggestions(false);
    setMentionTriggerIndex(-1);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursorPosition, nextCursorPosition);
      }
    }, 0);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setContent(value);
    updateMentionState(value, event.target.selectionStart);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    updateMentionState(textarea.value, textarea.selectionStart);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestionOptions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestionOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestionOptions.length) % suggestionOptions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      insertSuggestion(suggestionOptions[selectedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative space-y-2">
      {showSuggestions && suggestionOptions.length > 0 && (
        <MentionSuggestions
          options={suggestionOptions}
          selectedIndex={selectedIndex}
          onSelect={insertSuggestion}
          onHover={setSelectedIndex}
        />
      )}

      <Textarea
        ref={(el) => {
          textareaRef.current = el;
        }}
        value={content}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        className="min-h-11 resize-none rounded-xl border-neutral-200 bg-white text-sm shadow-xs focus-visible:border-violet-400 focus-visible:ring-violet-200"
      />
      {(trimmedContent || onCancel) && (
        <div className="flex items-center gap-x-2">
          {trimmedContent && (
            <Button
              type="button"
              size="sm"
              disabled={isLoading}
              onClick={() => {
                onSubmit(content);
                if (!onCancel) {
                  setContent("");
                }
              }}
              className="h-8 rounded-lg bg-violet-600 px-4 text-xs text-white hover:bg-violet-700"
            >
              {submitLabel}
            </Button>
          )}
          {onCancel && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isLoading}
              onClick={onCancel}
              className="h-8 rounded-lg px-3 text-xs text-neutral-500 hover:bg-neutral-100"
            >
              Hủy
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

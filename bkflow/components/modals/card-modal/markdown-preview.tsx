"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const normalizeMarkdown = (value: string | null | undefined) => value ?? "";

const isBulletLine = (line: string) => /^[-*]\s+/.test(line.trim());

const isHeadingLine = (line: string) => /^#{1,6}\s+/.test(line.trim());

const isSafeMarkdownUrl = (url: string) => /^https?:\/\/[^\s)]+$/i.test(url);

const renderInlineMarkdown = (text: string, keyPrefix: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let index = 0;
  let tokenIndex = 0;

  const pushText = (value: string) => {
    if (value) {
      nodes.push(value);
    }
  };

  while (index < text.length) {
    const linkMatch = text
      .slice(index)
      .match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i);

    if (linkMatch && isSafeMarkdownUrl(linkMatch[2])) {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${tokenIndex}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer noopener nofollow"
          className="font-medium text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900"
          onClick={(event) => event.stopPropagation()}
        >
          {linkMatch[1]}
        </a>,
      );
      index += linkMatch[0].length;
      tokenIndex += 1;
      continue;
    }

    if (text.startsWith("**", index)) {
      const boldEnd = text.indexOf("**", index + 2);

      if (boldEnd !== -1 && boldEnd > index + 2) {
        const content = text.slice(index + 2, boldEnd);

        nodes.push(
          <strong
            key={`${keyPrefix}-bold-${tokenIndex}`}
            className="font-semibold text-neutral-900"
          >
            {renderInlineMarkdown(content, `${keyPrefix}-bold-${tokenIndex}`)}
          </strong>,
        );
        index = boldEnd + 2;
        tokenIndex += 1;
        continue;
      }
    }

    if (text.startsWith("++", index)) {
      const underlineEnd = text.indexOf("++", index + 2);

      if (underlineEnd !== -1 && underlineEnd > index + 2) {
        const content = text.slice(index + 2, underlineEnd);

        nodes.push(
          <u
            key={`${keyPrefix}-underline-${tokenIndex}`}
            className="underline underline-offset-2 decoration-neutral-400"
          >
            {renderInlineMarkdown(content, `${keyPrefix}-underline-${tokenIndex}`)}
          </u>,
        );
        index = underlineEnd + 2;
        tokenIndex += 1;
        continue;
      }
    }

    if (text[index] === "*" && text[index + 1] !== "*") {
      const italicEnd = text.indexOf("*", index + 1);

      if (italicEnd !== -1 && italicEnd > index + 1) {
        const content = text.slice(index + 1, italicEnd);

        nodes.push(
          <em key={`${keyPrefix}-italic-${tokenIndex}`} className="italic">
            {renderInlineMarkdown(content, `${keyPrefix}-italic-${tokenIndex}`)}
          </em>,
        );
        index = italicEnd + 1;
        tokenIndex += 1;
        continue;
      }
    }

    pushText(text[index]);
    index += 1;
  }

  return nodes;
};

const renderBulletItem = (item: string, keyPrefix: string) => {
  const checklistMatch = item.match(/^(\s*)\[( |x|X)\]\s+(.+)$/);

  if (!checklistMatch) {
    return {
      isChecklist: false,
      content: renderInlineMarkdown(item, keyPrefix),
    };
  }

  const isChecked = checklistMatch[2].toLowerCase() === "x";

  return {
    isChecklist: true,
    content: (
      <span className="flex min-w-0 items-start gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-white",
            isChecked
              ? "border-violet-600 bg-violet-600"
              : "border-neutral-300 bg-white",
          )}
        >
          {isChecked && <Check className="h-3 w-3" />}
        </span>
        <span className="min-w-0 whitespace-pre-wrap">
          {checklistMatch[1]}
          {renderInlineMarkdown(checklistMatch[3], `${keyPrefix}-check`)}
        </span>
      </span>
    ),
  };
};

export const MarkdownPreview = ({
  value,
  emptyText,
  className,
}: {
  value: string | null | undefined;
  emptyText: string;
  className?: string;
}) => {
  const lines = normalizeMarkdown(value).split(/\r?\n/);
  const hasContent = lines.some((line) => line.trim());
  const blocks: ReactNode[] = [];

  if (!hasContent) {
    return <div className={cn("text-neutral-400", className)}>{emptyText}</div>;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      blocks.push(<div key={`space-${index}`} className="h-2" />);
      continue;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = renderInlineMarkdown(headingMatch[2], `heading-${index}`);
      const headingClass = cn(
        "whitespace-pre-wrap text-neutral-900",
        level === 1 && "text-2xl font-semibold leading-tight",
        level === 2 && "text-xl font-semibold leading-snug",
        level === 3 && "text-lg font-semibold leading-snug",
        level === 4 && "text-base font-semibold",
        level === 5 && "text-sm font-semibold",
        level === 6 && "text-xs font-semibold uppercase text-neutral-500",
      );

      blocks.push(
        <div key={`heading-${index}`} className={headingClass}>
          {content}
        </div>,
      );
      continue;
    }

    if (isBulletLine(trimmedLine)) {
      const bulletItems: string[] = [];
      let bulletIndex = index;

      while (bulletIndex < lines.length && isBulletLine(lines[bulletIndex])) {
        bulletItems.push(lines[bulletIndex].replace(/^(\s*)[-*]\s+/, "$1"));
        bulletIndex += 1;
      }

      blocks.push(
        <ul key={`list-${index}`} className="list-disc space-y-1 pl-5">
          {bulletItems.map((item, itemIndex) => {
            const renderedItem = renderBulletItem(item, `list-${index}-${itemIndex}`);

            return (
              <li
                key={`list-${index}-${itemIndex}`}
                className={cn(
                  "whitespace-pre-wrap pl-0.5",
                  renderedItem.isChecklist && "list-none",
                )}
              >
                {renderedItem.content}
              </li>
            );
          })}
        </ul>,
      );

      index = bulletIndex - 1;
      continue;
    }

    const paragraphLines = [line];
    let paragraphIndex = index + 1;

    while (
      paragraphIndex < lines.length &&
      lines[paragraphIndex].trim() &&
      !isHeadingLine(lines[paragraphIndex]) &&
      !isBulletLine(lines[paragraphIndex])
    ) {
      paragraphLines.push(lines[paragraphIndex]);
      paragraphIndex += 1;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="whitespace-pre-wrap">
        {renderInlineMarkdown(paragraphLines.join("\n"), `paragraph-${index}`)}
      </p>,
    );

    index = paragraphIndex - 1;
  }

  return (
    <div className={cn("space-y-2 break-words text-neutral-700", className)}>
      {blocks}
    </div>
  );
};

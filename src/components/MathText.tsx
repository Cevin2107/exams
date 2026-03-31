import katex from "katex";
import React from "react";

interface MathTextProps {
  text: string;
  className?: string;
}

function renderLatexSegment(content: string, displayMode: boolean) {
  try {
    return katex.renderToString(content, {
      throwOnError: false,
      displayMode,
      output: "html",
      strict: "ignore",
    });
  } catch {
    return content;
  }
}

function splitMathSegments(text: string) {
  const normalized = text
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$");

  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g;
  const parts: Array<{ type: "text" | "math"; value: string; displayMode?: boolean }> = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: normalized.slice(lastIndex, match.index) });
    }

    const token = match[0];
    const isDisplay = token.startsWith("$$") && token.endsWith("$$");
    const inner = isDisplay ? token.slice(2, -2) : token.slice(1, -1);
    parts.push({ type: "math", value: inner.trim(), displayMode: isDisplay });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < normalized.length) {
    parts.push({ type: "text", value: normalized.slice(lastIndex) });
  }

  return parts;
}

export function MathText({ text, className }: MathTextProps) {
  const segments = splitMathSegments(text || "");

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <span key={index} className="whitespace-pre-wrap">
              {segment.value}
            </span>
          );
        }

        const html = renderLatexSegment(segment.value, Boolean(segment.displayMode));
        return (
          <span
            key={index}
            className={segment.displayMode ? "my-2 block overflow-x-auto" : "inline-block align-baseline"}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}

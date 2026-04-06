import katex from "katex";
import React from "react";

interface MathTextProps {
  text: string;
  className?: string;
}

function humanizePlainLatex(text: string) {
  if (!text) return text;

  return text
    // Repair common OCR/AI typo for fraction command.
    .replace(/[/\\]\s*fraq/gi, "\\frac")
    .replace(/\\{2,}/g, "\\")
    // Convert common math commands to readable symbols.
    .replace(/\\times|\\cdot/gi, "×")
    .replace(/\\div/gi, "÷")
    .replace(/\\pm/gi, "±")
    .replace(/\\leq|\\le/gi, "≤")
    .replace(/\\geq|\\ge/gi, "≥")
    .replace(/\\neq/gi, "≠")
    .replace(/\\approx/gi, "≈")
    .replace(/\\infty/gi, "∞")
    .replace(/\\pi/gi, "π")
    .replace(/\\alpha/gi, "α")
    .replace(/\\beta/gi, "β")
    .replace(/\\gamma/gi, "γ")
    // Square root: \sqrt{x} => √(x)
    .replace(/\\sqrt\s*\{([^{}]+)\}/gi, "√($1)")
    // Superscript/subscript compact forms.
    .replace(/\^\{([^{}]+)\}/g, "^($1)")
    .replace(/_\{([^{}]+)\}/g, "_($1)")
    // Unescape braces used in plain text.
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}");
}

function normalizeFractionsForMathDetection(text: string) {
  if (!text) return text;

  return text
    // Fix common typo first.
    .replace(/[/\\]\s*fraq/gi, "\\frac")
    // Convert simple numeric fractions into LaTeX fractions for stacked rendering.
    .replace(/(^|[^\w\\])(\d{1,4})\s*\/\s*(\d{1,4})(?=$|[^\w])/g, (_m, pre, a, b) => `${pre}\\frac{${a}}{${b}}`);
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
  const normalized = normalizeFractionsForMathDetection(
    text
    .replace(/\\\[/g, "$$")
    .replace(/\\\]/g, "$$")
    .replace(/\\\(/g, "$")
    .replace(/\\\)/g, "$")
  );

  const regex = /(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$|\\(?:frac\s*\{[^{}]+\}\s*\{[^{}]+\}|sqrt\s*\{[^{}]+\}|[a-zA-Z]+)|[A-Za-z0-9]+(?:_\{[^{}]+\}|_[A-Za-z0-9]+|\^\{[^{}]+\}|\^[A-Za-z0-9]+){1,3})/g;
  const parts: Array<{ type: "text" | "math"; value: string; displayMode?: boolean }> = [];

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: humanizePlainLatex(normalized.slice(lastIndex, match.index)) });
    }

    const token = match[0];
    if (token.startsWith("$$") && token.endsWith("$$")) {
      parts.push({ type: "math", value: token.slice(2, -2).trim(), displayMode: true });
    } else if (token.startsWith("$") && token.endsWith("$")) {
      parts.push({ type: "math", value: token.slice(1, -1).trim(), displayMode: false });
    } else {
      parts.push({ type: "math", value: token.trim(), displayMode: false });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < normalized.length) {
    parts.push({ type: "text", value: humanizePlainLatex(normalized.slice(lastIndex)) });
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
            className={segment.displayMode ? "my-2 block overflow-x-auto" : "inline align-baseline"}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}

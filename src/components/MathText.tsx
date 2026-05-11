import katex from "katex";
import React from "react";

interface MathTextProps {
  text: string;
  className?: string;
}

function humanizePlainLatex(text: string) {
  if (!text) return text;

  return text
    // 1. Fix slash/backslash-prefixed LaTeX commands (Gemini & DeepSeek hay output sai)
    .replace(/[/\\]\s*fraq/gi, "\\frac")
    .replace(/[/\\]\s*frac/gi, "\\frac")
    .replace(/[/\\]\s*sqrt/gi, "\\sqrt")
    .replace(/[/\\]\s*cdot/gi, "\\cdot")
    .replace(/[/\\]\s*times/gi, "\\times")
    .replace(/[/\\]\s*div(?=\s|$)/gi, "\\div")
    .replace(/[/\\]\s*pm(?=\s|$)/gi, "\\pm")
    .replace(/[/\\]\s*leq(?=\s|$)/gi, "\\leq")
    .replace(/[/\\]\s*geq(?=\s|$)/gi, "\\geq")
    .replace(/[/\\]\s*neq(?=\s|$)/gi, "\\neq")
    .replace(/[/\\]\s*infty(?=\s|$)/gi, "\\infty")
    .replace(/[/\\]\s*pi(?=\s|$|[^a-z])/gi, "\\pi")
    .replace(/[/\\]\s*alpha(?=\s|$)/gi, "\\alpha")
    .replace(/[/\\]\s*beta(?=\s|$)/gi, "\\beta")
    .replace(/[/\\]\s*gamma(?=\s|$)/gi, "\\gamma")
    .replace(/[/\\]\s*theta(?=\s|$)/gi, "\\theta")
    .replace(/[/\\]\s*sin(?=\s|\()/gi, "\\sin")
    .replace(/[/\\]\s*cos(?=\s|\()/gi, "\\cos")
    .replace(/[/\\]\s*tan(?=\s|\()/gi, "\\tan")
    .replace(/[/\\]\s*log(?=\s|\()/gi, "\\log")
    .replace(/[/\\]\s*ln(?=\s|\()/gi, "\\ln")
    .replace(/[/\\]\s*left\s*([([{|])/gi, "\\left$1")
    .replace(/[/\\]\s*right\s*([)\]|}])/gi, "\\right$1")

    // 2. Bare frac without backslash
    .replace(/\bfrac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/gi, "\\frac{$1}{$2}")
    .replace(/\bfrac\s*([0-9])\s*([0-9]{1,2})\b/gi, "\\frac{$1}{$2}")

    // 3. Unicode square root
    .replace(/\u221a\s*\(([^()]+)\)/g, "\\sqrt{$1}")
    .replace(/\u221a\s*\{([^{}]+)\}/g, "\\sqrt{$1}")
    .replace(/\u221a\s*(\d+)/g, "\\sqrt{$1}")

    // 4. Collapse excess backslashes (e.g. \\\frac → \frac)
    .replace(/\\{2,}/g, "\\")

    // 5. Convert common math commands to readable symbols (only for text segments)
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
    // Fix all slash/backslash-prefixed LaTeX commands
    .replace(/[/\\]\s*fraq/gi, "\\frac")
    .replace(/[/\\]\s*frac/gi, "\\frac")
    .replace(/[/\\]\s*sqrt/gi, "\\sqrt")
    .replace(/[/\\]\s*left\s*([([{|])/gi, "\\left$1")
    .replace(/[/\\]\s*right\s*([)\]|}])/gi, "\\right$1")
    // Collapse excess backslashes
    .replace(/\\{2,}(?=[a-zA-Z])/g, "\\")
    // Convert simple numeric fractions into LaTeX fractions for stacked rendering.
    .replace(/(^|[^\w\\])(\d{1,4})\s*\/\s*(\d{1,4})(?=$|[^\w])/g, (_m, pre, a, b) => `${pre}\\frac{${a}}{${b}}`);
}

function renderLatexSegment(content: string, displayMode: boolean) {
  const normalizedContent = content
    // AI/OCR sometimes emits \\\frac or \\sqrt; KaTeX interprets leading \\ as a line break.
    .replace(/\\{2,}(?=(?:frac|sqrt|sum|int|lim|sin|cos|tan|log|ln|pi|alpha|beta|gamma|theta)\b)/g, "\\");

  try {
    return katex.renderToString(normalizedContent, {
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

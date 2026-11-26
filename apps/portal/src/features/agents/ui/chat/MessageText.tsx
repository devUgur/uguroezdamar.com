import type { ReactNode } from "react";

/**
 * Renders the small Markdown subset agents write: paragraphs, bullet and numbered lists, code
 * blocks, inline code, bold and links. Everything is React text, never HTML from the model.
 */
export function MessageText({ text }: { text: string }) {
  return <div className="flex flex-col gap-3 leading-relaxed break-words">{blocks(text)}</div>;
}

function blocks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = text.split(/```[^\n]*\n?([\s\S]*?)```/g);
  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      nodes.push(
        <pre key={`code-${index}`} className="overflow-x-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-5">
          <code>{part.replace(/\n$/, "")}</code>
        </pre>,
      );
      return;
    }
    part
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .forEach((block, blockIndex) => nodes.push(paragraph(block, `${index}-${blockIndex}`)));
  });
  return nodes;
}

function paragraph(block: string, key: string): ReactNode {
  const lines = block.split("\n");
  if (lines.every((line) => /^\s*[-*•]\s+/.test(line))) {
    return (
      <ul key={key} className="flex list-disc flex-col gap-1 pl-5">
        {lines.map((line, index) => (
          <li key={index}>{inline(line.replace(/^\s*[-*•]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }
  if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
    return (
      <ol key={key} className="flex list-decimal flex-col gap-1 pl-5">
        {lines.map((line, index) => (
          <li key={index}>{inline(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>
        ))}
      </ol>
    );
  }
  const heading = block.match(/^#{1,4}\s+(.+)$/);
  if (heading && lines.length === 1) {
    return (
      <p key={key} className="font-semibold">
        {inline(heading[1] ?? "")}
      </p>
    );
  }
  return (
    <p key={key} className="whitespace-pre-wrap">
      {inline(block)}
    </p>
  );
}

const TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g;

function inline(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, index) => {
    if (!part) return null;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    const href = link ? link[2] : /^https?:\/\//.test(part) ? part : null;
    if (href) {
      return (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-primary">
          {link ? link[1] : part}
        </a>
      );
    }
    return part;
  });
}

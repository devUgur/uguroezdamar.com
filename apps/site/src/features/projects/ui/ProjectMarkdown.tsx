import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** CMS content is untrusted input: render Markdown without enabling raw HTML or MDX. */
export function ProjectMarkdown({ source }: { source: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>;
}

import { compileMdx } from "@/src/features/blog/queries";

export async function MdxContent({ source }: { source: string }) {
  const content = await compileMdx(source);
  return <div className="prose prose-zinc max-w-none">{content}</div>;
}

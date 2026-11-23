import { compileMdx } from "@/src/content/mdx";

export async function MdxContent({ source }: { source: string }) {
  const content = await compileMdx(source);
  return content;
}

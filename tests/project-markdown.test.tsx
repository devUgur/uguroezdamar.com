import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectMarkdown } from "../apps/site/src/features/projects/ui/ProjectMarkdown";

describe("CMS project Markdown rendering", () => {
  it("renders ordinary Markdown", () => {
    const html = renderToStaticMarkup(<ProjectMarkdown source={"## Summary\n\n**Safe** text"} />);
    expect(html).toContain("<h2>Summary</h2>");
    expect(html).toContain("<strong>Safe</strong>");
  });

  it("does not execute JSX expressions or render raw HTML", () => {
    const html = renderToStaticMarkup(<ProjectMarkdown source={'{globalThis.__mdxExecuted = true}\n\n<script>globalThis.__mdxExecuted = true</script>'} />);
    expect(html).not.toContain("<script>");
    expect(html).toContain("globalThis.__mdxExecuted");
  });

  it("strips unsafe javascript links", () => {
    const html = renderToStaticMarkup(<ProjectMarkdown source="[click](javascript:alert%281%29)" />);
    expect(html).not.toContain("javascript:");
  });
});

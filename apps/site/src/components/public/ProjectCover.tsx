import Image from "next/image";

import type { Project } from "@/src/content/projects";

type Cover = NonNullable<Project["cover"]>;

export function ProjectCover({ cover, sizes, preload = false }: { cover: Cover; sizes: string; preload?: boolean }) {
  const image = <Image src={cover.src} alt={cover.alt} fill preload={preload} sizes={sizes} className="project-cover__image" />;

  if (cover.frame === "none") {
    return <div className="project-cover__unframed">{image}</div>;
  }

  if (cover.frame === "mobile") {
    return (
      <div className="project-cover__mobile-stage">
        <div className="project-cover__phone" aria-hidden="true">
          <span className="project-cover__phone-detail" aria-hidden="true" />
          <div className="project-cover__phone-screen">{image}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="project-cover__browser">
      <div className="project-cover__browser-bar" aria-hidden="true">
        <span className="project-cover__browser-controls"><i /><i /><i /></span>
        <span className="project-cover__browser-slot" />
        <span className="project-cover__browser-spacer" />
      </div>
      <div className="project-cover__browser-screen">{image}</div>
    </div>
  );
}

import Link from "next/link";

export function PageIntro({ section, title, description, backHref, backLabel }: {
  section: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="page-intro">
      <p className="page-eyebrow page-intro__eyebrow">
        {backHref ? <><Link href={backHref} className="link-underline">{backLabel}</Link><span aria-hidden="true" className="mx-2">/</span></> : null}
        {section}
      </p>
      <div className="page-intro__content">
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-lede">{description}</p> : null}
      </div>
    </header>
  );
}

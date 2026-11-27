import Link from "next/link";
import type { AgentConfig } from "../../types";
import { usePortalUrl } from "../portal";
import { Facts, mono, Section } from "./ConfigParts";

const STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog",
  ready: "Ready",
  in_progress: "In Arbeit",
  review: "Code Review",
  qa: "QA",
  blocked: "Blockiert",
  done: "Erledigt",
};

const PRIORITY_LABEL: Record<string, string> = { low: "niedrig", normal: "normal", high: "hoch", urgent: "dringend" };

/** Where this agent sits in the organization: department, role profile, executable definition. */
export function OrganizationSection({ organization }: { organization: AgentConfig["organization"] }) {
  const portalUrl = usePortalUrl();
  if (!organization) {
    return (
      <Section title="Rolle und Organisation">
        <p className="text-muted-foreground">Dieser Agent hat noch keine Definition im Organisationskatalog.</p>
      </Section>
    );
  }
  const { department, role, definition } = organization;
  return (
    <Section title="Rolle und Organisation">
      <Facts
        rows={[
          ["Abteilung", department],
          ["Rolle", `${role.name} (v${role.version})`],
          ["Definition", <>{mono(definition.id)} · Runtime {mono(definition.runtimeKey)}</>],
        ]}
      />
      <p className="text-muted-foreground">{role.purpose}</p>
      <ul className="list-inside list-disc text-muted-foreground">
        {role.responsibilities.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <a href={`${portalUrl}/organization`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Alle Rollen und Abteilungen
      </a>
    </Section>
  );
}

/** What this agent is working on, with a way into the board and into the run of each task. */
export function WorkSection({ work }: { work: AgentConfig["work"] }) {
  const portalUrl = usePortalUrl();
  const total = Object.values(work.byStatus).reduce((sum, count) => sum + count, 0);
  return (
    <Section title={`Aufgaben (${total})`}>
      {work.active.length ? (
        <ul className="flex flex-col gap-3">
          {work.active.map((task) => (
            <li key={task.id} className="flex flex-col gap-0.5">
              <span className="font-medium">{task.title}</span>
              <span className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <span>{STATUS_LABEL[task.status] ?? task.status}</span>
                <span>Priorität {PRIORITY_LABEL[task.priority] ?? task.priority}</span>
                {task.threadId ? (
                  <Link href={`/chat/${task.threadId}`} className="underline underline-offset-4">
                    Lauf öffnen
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Keine offenen Aufgaben. Übergib im Board eine Aufgabe mit dem Status „Ready“.</p>
      )}
      <a href={`${portalUrl}/work`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        Zum Aufgaben-Board
      </a>
    </Section>
  );
}

import Link from "next/link";
import type { OrganizationCatalog } from "../types";
import { OrganizationLiveSync } from "./OrganizationLiveSync";

export function OrganizationView({ catalog, error, canManage = false }: { catalog: OrganizationCatalog | null; error: string | null; canManage?: boolean }) {
  if (!catalog) {
    return <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10"><h1 className="font-serif text-3xl">Organisation</h1><p role="status" className="text-sm text-destructive">{error}</p></main>;
  }

  const rolesByDepartment = new Map<string, typeof catalog.roles>();
  for (const role of catalog.roles) rolesByDepartment.set(role.departmentId, [...(rolesByDepartment.get(role.departmentId) ?? []), role]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Control Plane</p>
        <h1 className="font-serif text-3xl">Organisation</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Rollen beschreiben Verantwortlichkeiten. Nur eine registrierte Runtime-Definition macht eine Agenteninstanz ausführbar. Die 3D-Ansicht zeigt ausschließlich echte Instanzen.</p>
        <OrganizationLiveSync />
        {canManage ? <Link href="/organization/manage" className="mt-2 inline-flex w-fit rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Organisation verwalten</Link> : null}
      </header>

      <section className="flex flex-col gap-4" aria-labelledby="staff-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="staff-title" className="font-serif text-xl">Aktive Instanzen</h2><span className="text-sm text-muted-foreground">{catalog.instances.filter((instance) => instance.active).length} gespeichert · {catalog.instances.filter((instance) => instance.active && instance.executable).length} ausführbar</span></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.instances.filter((instance) => instance.active).map((instance) => {
            const role = catalog.roles.find((item) => item.id === instance.roleId);
            return <article key={instance.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-medium">{instance.name}</h3><span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{instance.executable ? "Runtime registriert" : "nicht ausführbar"}</span></div><p className="text-sm text-muted-foreground">{role?.name ?? "Ohne Rollenprofil"} · {instance.id}</p>{instance.executable ? <Link href={`/office?agent=${encodeURIComponent(instance.id)}`} className="text-sm underline underline-offset-4">Im Office zeigen</Link> : null}</article>;
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="departments-title">
        <h2 id="departments-title" className="font-serif text-xl">Abteilungen und Rollenprofile</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {catalog.departments.map((department) => (
            <article key={department.id} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
              <div><h3 className="font-medium">{department.name}</h3><p className="mt-1 text-sm text-muted-foreground">{department.purpose}</p></div>
              <ul className="flex flex-col divide-y divide-border">
                {(rolesByDepartment.get(department.id) ?? []).map((role) => {
                  const definition = catalog.definitions.find((item) => item.roleId === role.id);
                  const staff = catalog.instances.filter((instance) => instance.active && instance.roleId === role.id);
                  return <li key={role.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-medium">{role.name}</h4><span className="font-mono text-xs text-muted-foreground">v{role.version}</span></div>
                    <p className="text-sm text-muted-foreground">{role.purpose}</p>
                    <ul className="list-inside list-disc text-xs text-muted-foreground">{role.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
                    <p className="text-xs">{staff.length ? `${staff.length} aktive Instanz${staff.length === 1 ? "" : "en"}` : "Noch keine aktive Instanz"}{definition ? ` · Definition ${definition.id} v${definition.version}` : " · keine Runtime-Definition"}</p>
                  </li>;
                })}
              </ul>
            </article>
          ))}
        </div>
      </section>
      <p className="text-xs text-muted-foreground">Rollenprofile lassen sich versioniert pflegen. Runtime-Definitionen, Tool-Rechte und neue ausführbare Mitarbeitende bleiben codeverwaltet und benötigen eine separate technische Prüfung.</p>
    </main>
  );
}

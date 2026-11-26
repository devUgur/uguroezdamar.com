import type { OrganizationAuditEntry, OrganizationCatalog } from "../types";
import { createOrganizationRole, updateOrganizationInstance, updateOrganizationRole } from "../actions";
import { OrganizationLiveSync } from "./OrganizationLiveSync";

const field = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm";
const label = "block text-sm font-medium";

export function OrganizationManager({ catalog, audit, error, auditError, notice }: { catalog: OrganizationCatalog | null; audit: OrganizationAuditEntry[]; error: string | null; auditError: string | null; notice: string | null }) {
  const apiReady = !auditError;
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Owner Control Plane</p>
        <h1 className="font-serif text-3xl">Organisationsverwaltung</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Rollenänderungen werden versioniert und auditiert. Runtime-Definitionen, Tool-Rechte und neue ausführbare Agenten bleiben codeverwaltet.</p>
        <OrganizationLiveSync />
      </header>
      {notice ? <p role="status" className="rounded-md border border-border p-3 text-sm">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p> : null}
      {!catalog ? null : <>
        <section className="flex flex-col gap-4" aria-labelledby="instance-title">
          <div><h2 id="instance-title" className="font-serif text-xl">Registrierte Agenteninstanzen</h2><p className="mt-1 text-sm text-muted-foreground">Nur bekannte Runtime-Instanzen lassen sich umbenennen, umplatzieren oder deaktivieren. Aktive Runs blockieren eine Deaktivierung.</p></div>
          <div className="grid gap-4 lg:grid-cols-2">
            {catalog.instances.map((instance) => <form key={instance.id} action={updateOrganizationInstance} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
              <input type="hidden" name="id" value={instance.id} /><input type="hidden" name="version" value={instance.version ?? ""} />
              <div className="flex items-center justify-between gap-3"><h3 className="font-medium">{instance.id}</h3><span className="text-xs text-muted-foreground">{instance.executable ? "Runtime registriert" : "nicht ausführbar"} · v{instance.version ?? "—"}</span></div>
              <label className={label}>Anzeigename<input className={field} name="name" required maxLength={120} defaultValue={instance.name} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>Desk X<input className={field} name="deskX" type="number" min={0} max={40} required defaultValue={instance.desk.x ?? 0} /></label>
                <label className={label}>Desk Y<input className={field} name="deskY" type="number" min={0} max={40} required defaultValue={instance.desk.y ?? 0} /></label>
              </div>
              <label className={label}>Status<select className={field} name="active" defaultValue={String(instance.active)}><option value="true">Aktiv</option><option value="false">Deaktiviert</option></select></label>
              <button disabled={!apiReady} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{apiReady ? "Instanz speichern" : "API-Dev aktualisieren"}</button>
            </form>)}
          </div>
        </section>
        <section className="flex flex-col gap-4" aria-labelledby="roles-title">
          <div><h2 id="roles-title" className="font-serif text-xl">Rollenprofile und Versionen</h2><p className="mt-1 text-sm text-muted-foreground">Ein Profil ist keine Runtime und erhält durch diese Verwaltung keine zusätzlichen Rechte.</p></div>
          <div className="grid gap-4 lg:grid-cols-2">
            {catalog.roles.map((role) => <form key={role.id} action={updateOrganizationRole} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5">
              <input type="hidden" name="id" value={role.id} /><input type="hidden" name="version" value={role.version} />
              <div className="flex items-center justify-between"><h3 className="font-medium">{role.id}</h3><span className="font-mono text-xs text-muted-foreground">v{role.version}</span></div>
              <label className={label}>Name<input className={field} name="name" required maxLength={120} defaultValue={role.name} /></label>
              <label className={label}>Zweck<textarea className={field} name="purpose" required maxLength={1000} rows={3} defaultValue={role.purpose} /></label>
              <label className={label}>Verantwortlichkeiten<textarea className={field} name="responsibilities" rows={4} defaultValue={role.responsibilities.join("\n")} /><span className="text-xs text-muted-foreground">Ein Eintrag pro Zeile, maximal 20</span></label>
              <label className={label}>Fähigkeiten<textarea className={field} name="capabilities" rows={3} defaultValue={role.capabilities.join("\n")} /><span className="text-xs text-muted-foreground">Ein Eintrag pro Zeile, maximal 20</span></label>
              <button disabled={!apiReady} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">{apiReady ? "Rolle als neue Version speichern" : "API-Dev aktualisieren"}</button>
            </form>)}
          </div>
        </section>
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5" aria-labelledby="new-role-title">
          <div><h2 id="new-role-title" className="font-serif text-xl">Rollenprofil ergänzen</h2><p className="mt-1 text-sm text-muted-foreground">Das neue Profil bleibt geplant, bis eine passende Runtime in Code geprüft und registriert wurde.</p></div>
          <form action={createOrganizationRole} className="grid gap-3 md:grid-cols-2">
            <label className={label}>Stabile ID<input className={field} name="id" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={40} /></label>
            <label className={label}>Abteilung<select className={field} name="departmentId" required>{catalog.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            <label className={label}>Name<input className={field} name="name" required maxLength={120} /></label>
            <label className={label}>Zweck<input className={field} name="purpose" required maxLength={1000} /></label>
            <label className={label}>Verantwortlichkeiten<textarea className={field} name="responsibilities" rows={4} /><span className="text-xs text-muted-foreground">Ein Eintrag pro Zeile</span></label>
            <label className={label}>Fähigkeiten<textarea className={field} name="capabilities" rows={4} /><span className="text-xs text-muted-foreground">Ein Eintrag pro Zeile</span></label>
            <button disabled={!apiReady} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground md:col-span-2 disabled:cursor-not-allowed disabled:opacity-50">{apiReady ? "Rollenprofil anlegen" : "API-Dev aktualisieren"}</button>
          </form>
        </section>
        <section className="flex flex-col gap-4" aria-labelledby="audit-title">
          <div><h2 id="audit-title" className="font-serif text-xl">Änderungsprotokoll</h2><p className="mt-1 text-sm text-muted-foreground">Die letzten 50 Änderungen an Organisationsprofilen und Instanzen.</p></div>
          {auditError ? <p role="alert" className="text-sm text-destructive">{auditError}</p> : null}
          {audit.length ? <ol className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
            {audit.map((entry) => <li key={entry.id} className="flex flex-col gap-2 p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><strong>{entry.scope} · {entry.entityId} · {entry.action}</strong><time className="text-xs text-muted-foreground" dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleString("de-DE")}</time></div>
              <p className="text-xs text-muted-foreground">Änderung durch {entry.actor}</p>
              <details><summary className="cursor-pointer text-xs underline underline-offset-4">Vorher und nachher ansehen</summary><pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre></details>
            </li>)}
          </ol> : <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Noch keine Organisationsänderungen protokolliert.</p>}
        </section>
      </>}
    </main>
  );
}

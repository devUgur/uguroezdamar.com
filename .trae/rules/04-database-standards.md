---
applyTo: '**'
---

Zweck

Saubere Datenbank-Infrastruktur (PostgreSQL auf Neon, Drizzle ORM). Entscheidung: docs/architecture/decisions/0016-postgres-neon-infisical-cli.md

Inhalt

Ein Client pro Serverprozess: nur `getDb()` aus packages/server/src/db/client.ts

Keine neue Connection pro Request, kein eigener `postgres()`-Aufruf außerhalb von packages/server und tooling/cli

Schema nur in packages/server/src/db/schema.ts; jede Schemaänderung mit Migration (`pnpm db:generate`, geprüft durch `pnpm db:check`)

Migrationen sind additiv und werden nie nachträglich editiert

Nur server-side import

Spalten für alles, wonach gefiltert oder sortiert wird; jsonb nur für eingebettete Listen

IDs aus URLs vor der Abfrage mit `isUuid()` prüfen

Mehrschrittige Schreibvorgänge in einer Transaktion

Connection-Strings kommen ausschließlich aus Infisical (`pnpm dev`, `pnpm ugur run`); keine .env-Dateien

# ADR 0022: Entwürfe ausschließlich in geschützten Vorschauen prüfen

- Status: proposed
- Datum: 2026-10-19
- Beteiligte: Projektverantwortliche
- Ergänzt: [ADR 0019](0019-content-from-git.md), [ADR 0020](0020-vercel-hosting.md)

## Kontext

Der Owner möchte echte Portfolio-Projektentwürfe vor einer öffentlichen Freigabe online visuell prüfen. ADR 0019 hält Git/MDX als einzige Quelle und schließt Drafts aus Produktionsbuilds und der Sitemap aus. Vercel schützt die Projektvorschauen derzeit mit Deployment Protection `all_except_custom_domains`; nur ein vollständiger Bypass ist für `pnpm ugur smoke` im Infisical-`dev`-Scope hinterlegt.

Ein Draft-Flag, `noindex` oder eine schwer zu erratende URL allein schützen Inhalte und statische Assets nicht vor öffentlichem Zugriff.

## Entscheidungsvorschlag

1. `draft: true` bleibt die Inhaltsfreigabegrenze. Veröffentlichte Builds filtern Drafts selbst dann heraus, wenn ein Aufrufer explizit `includeDrafts: true` angibt.
2. Draft-Inhalte dürfen auf Vercel nur in der Umgebung `preview` erscheinen, wenn `VERCEL_ENV=preview` und `VERCEL_URL` vorhanden sind. Vercel Deployment Protection `all_except_custom_domains` muss für alle Preview-Domains aktiv sein.
3. Lokale Entwicklungsserver dürfen Drafts wie bisher darstellen. Die Vorschau führt keine Drafts in Sitemap oder `robots`-Indexierung auf; Projektdetailseiten tragen `noindex`.
4. Draft-Bilder und andere Assets dürfen nur eingecheckte Projektdateien sein, die unter derselben Deployment Protection ausgeliefert werden. Öffentliche, separat gehostete Medien-URLs gehören nicht in einen Draft.
5. Die öffentliche Produktion erhält Draft-Inhalte erst, wenn ein konkreter Inhalts-PR Rolle, Beiträge, Fakten, Bildrechte, Alt-Texte und Projektlinks bestätigt sowie `draft: false` setzt.
6. Hosting-Schutz wird vor und nach jeder Preview-/Hostingänderung mit `pnpm ugur hosting status` kontrolliert. Ein Verlust des Schutzes blockiert jeden Draft-Preview-Release.

## Alternativen

- **Drafts in Production mit `noindex`:** `noindex` verhindert keine direkte Einsicht; abgelehnt.
- **Drafts auf allen Preview-URLs ohne Deployment Protection:** Inhalte und Assets wären öffentlich erreichbar; abgelehnt.
- **Eigene Preview-Auth in der Site:** dupliziert Vercels bestehende Schutzschicht und erfordert neue Zugangsdaten und Ablauf-/Auditlogik; solange Vercel-Schutz genügt, abgelehnt.
- **Drafts ausschließlich lokal:** sicher, aber erfüllt den gewünschten geräteunabhängigen visuellen Review nicht; abgelehnt, solange Vercel-Schutz besteht.

## Konsequenzen

- Preview-Deployments enthalten bewusst Draft-HTML und benötigen einen wirksamen Edge-Schutz.
- Production-Generierung und explizite `includeDrafts`-Abfragen bleiben strikt draft-frei.
- Sitemap und Metadata werden unabhängig vom Preview-Zugriff geprüft; `noindex` ist zusätzliche Hygiene, kein Auth-Ersatz.
- Deployment Protection, Preview-Bypass und Preview-Datenbank sind getrennte Sicherheitskonfigurationen. Der Bypass-Schlüssel wird nur für vertrauenswürdige Smoke-Läufe genutzt, nie in URLs oder Inhalten.
- Wenn `hosting status` nicht mehr `all_except_custom_domains` meldet, muss die Draft-Aufnahme in Previews deaktiviert oder der Schutz vor erneutem Deploy wiederhergestellt werden.

## Verifikation und Rückprüfung

Die vorgeschlagene Entscheidung benötigt Review mit dem geschichteten PR. CI prüft, dass lokale und geschützte Preview-Kontexte Drafts sehen, Production sie auch bei explizitem `includeDrafts: true` ausblendet und Sitemap/Metadata keine Drafts indexieren. Hosting-Status vor und nach dem Vercel-Preview belegt den Edge-Schutz. Ein Production-Release wird separat mit `pnpm ugur smoke` und manuellem Promote freigegeben.

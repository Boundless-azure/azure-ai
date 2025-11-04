# Xiaolan (Projektüberblick · Deutsch)

 Sprachwechsel: [English](/docs/readme/README.en.md) · [Deutsch](/docs/readme/README.de.md) · [中文](/docs/readme/README.zh-CN.md) · [עברית](/docs/readme/README.he.md) · [ไทย](/docs/readme/README.th.md) · [Deutsch (Österreich)](/docs/readme/README.de-AT.md)

## Positionierung & Ziele

1. Projektname: „Xiaolan“.
2. Neuer Interaktions‑Einstieg: KI ersetzt das alte, klicklastige Web‑Modell. Nutzer steuern Oberfläche oder Daten per natürlicher Sprache.
3. Selbstwachstum: KI generiert Code‑Plugins, die ins System zurückfließen – ein fortlaufender Fähigkeits‑Kreislauf.
4. Generations‑Limits + Transaktionsbus (HookBus): KI‑Output wird zu gering abhängigen, wenig verschachtelten, unternehmens‑tauglichen Code mit Kontrolle und Auditierbarkeit.
5. Frontend‑Komponenten‑Ausführungsspezifikation für KI: KI kann Komponenten direkt und vorhersagbar/prüfbar steuern.

## Aktueller Stand (Bereits umgesetzt)

- Konversation & Streaming
  - Non‑Streaming: `ConversationService.chat()`
  - Streaming (SSE‑artig): `ConversationService.chatStream()`

- Native Function‑Calls via Service‑Handles
  - Beschreibungen unter `src/core/function-call/descriptions/`; jeder Service exportiert `getHandle()` mit `description/validate/execute`.
  - Die Konversationsschicht injiziert `toolDescriptions` je nach aktivierten Services (native Modell‑Function‑Calls).

- Verfügbare Services
  - `PluginOrchestratorService` → Funktion: `plugin_orchestrate`
    - Einstieg für „erst planen, dann generieren“.
    - Das Modell liefert nur `input`; System ergänzt `phase/modelId/temperature`.
  - `MysqlReadonlyService` → Funktion: `db_mysql_select`
    - Read‑only Abfragen. Validierung: `params` ist ein Array primitiver Werte (string/number/boolean/null); `limit` ist Pflicht. Ausgabe: `Record<string, unknown>[]`.
  - `ContextFunctionService` → Funktion: `context_window_keyword`
    - Alias: `context_keyword_window`.

- Servicebasierter Registrier‑Schalter (empfohlen)
  - Konfiguration: `src/app/conversation/conversation.module.ts`.
  - Beispiel: nur MySQL Read‑only aktivieren
    - `includeFunctionServices: [MysqlReadonlyService]`

- Ausführungsfluss (`ConversationService`)
  - Auflösen per Name (inkl. Alias), `validate`, anschließend `execute`.
  - Spezialfall: `plugin_orchestrate` → System ergänzt Parameter; Modell liefert nur `input`.

- Qualität & Zusammenarbeit
  - ESLint ignoriert ungenutzte Variablen mit Unterstrich‑Präfix; hilfreich in Function‑Call‑Kontexten.
  - Modulhinweise: `src/core/function-call/module.tip`.

## Frontend‑Komponenten‑Ausführung durch KI (Überblick)

- Aktionsbenennung: stabil, wiederholbar, z. B. `openModal` / `updateTable` / `navigate`.
- Parametervalidierung: Typen und Pflichtfelder definiert; ungeprüfte Nebenwirkungen ablehnen.
- Idempotenz: Wiederholte Ausführung führt nicht zu divergierendem Zustand; Transaktions‑Rollback unterstützen.
- Timeout & Retry: Ausführung mit Zeitlimit, Wiederholung und Fallback.
- Sicherheit & Audit: Jeder Lauf mit Logging und Kontext‑Snapshots.
- Transaktionsbus (HookBus): Front‑/Backend‑Aktionen vereinheitlicht für Reihenfolge & Konsistenz.

## Roadmap / Ausblick

- Direkte DB‑Statements (Schreiboperationen)
  - Sicherer SQL‑Einstieg: Whitelist, Placeholder‑Checks, Isolation sensibler Operationen.
  - Berechtigungen: Rollen/Mandanten‑Kontrollen mit Audit.

- DB‑Sicherheit & Berechtigungen
  - Feingranulare Kontrolle auf Schema/Tabellen/Spaltenebene.
  - Audit & Risikomanagement mit Alerts und Rollback.

- Intelligente Plugin‑Generierung (Selbstwachstum stärken)
  - Plan → Generierung → Test → Veröffentlichung.
  - Generations‑Limits: Abhängigkeitsanzahl, Versionen, Lizenzen steuern; tiefe Verschachtelung vermeiden.

- Seiten aus bestehenden Tabellen generieren
  - Automatisierte CRUD‑Bildschirme mit Routing & Berechtigungen.
  - Integration mit HookBus/Plugins (z. B. `plugins/customer-analytics`).

## Schnellstart

1) Installieren & Build

```bash
npm install
npm run build
```

2) Aktivierte Services konfigurieren (`includeFunctionServices`)

3) Dev‑Server starten (falls vorhanden)

```bash
npm run start:dev
```

Tipp: Für lokale DB‑Entwicklung siehe `docker/mysql/init` und `.env`. Zunächst `MysqlReadonlyService` nutzen; Schreiboperationen erst mit Berechtigungen und Audit.
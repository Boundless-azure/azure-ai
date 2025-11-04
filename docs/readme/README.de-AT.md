# Xiaolan (Projektübersicht · Deutsch/Österreich)

Sprachen wechseln: [Deutsch](/docs/readme/README.de.md) · [Deutsch (Österreich)](/docs/readme/README.de-AT.md) · [English](/docs/readme/README.en.md) · [中文](/docs/readme/README.zh-CN.md) · [עברית](/docs/readme/README.he.md) · [ไทย](/docs/readme/README.th.md)

## Positionierung und Ziel

1. Projektname: „Xiaolan“.
2. Neue Interaktionsform: KI ersetzt das klassische Klick-Web; Nutzer steuern UI und Daten per natürlicher Sprache.
3. Selbstwachstum: KI generiert Code‑Plugins, die zurück in das System fließen – ein kontinuierlicher Fähigkeits‑Kreislauf.
4. Generierungs‑Constraints + Transaktions‑Bus (HookBus): Niedrige Abhängigkeiten, kontrollierbar und auditierbar – geeignet für Unternehmen.
5. KI‑gesteuerte Frontend‑Komponenten: KI kontrolliert Komponenten direkt, vorhersagbar und überprüfbar.

## Aktueller Fortschritt (bereits implementiert)

- Konversation und Streaming
  - Non‑Streaming: `ConversationService.chat()`
  - Streaming (SSE‑ähnlich): `ConversationService.chatStream()`

- Native Function‑Call via Services
  - Beschreibungen unter `src/core/function-call/descriptions/`; jeder Service bietet `getHandle()` mit `description/validate/execute`.
  - Die Konversations‑Schicht fügt `toolDescriptions` je nach aktivierten Services hinzu (native Tool‑Calls des Modells).

- Verfügbare Function‑Call‑Services
  - `PluginOrchestratorService` → Funktion: `plugin_orchestrate`
    - Startpunkt für „Planen zuerst, Generieren danach“.
    - Das Modell sendet nur `input`; System ergänzt `phase/modelId/temperature`.
  - `MysqlReadonlyService` → Funktion: `db_mysql_select`
    - Read‑Only Queries; Validierung: `params` muss ein Array primitiver Werte sein (string/number/boolean/null) und `limit` erforderlich. Rückgabe: `Record<string, unknown>[]`.
  - `ContextFunctionService` → Funktion: `context_window_keyword`
    - Alias: `context_keyword_window`.

- Service‑basierte Registrierung (empfohlen)
  - Konfiguration in `src/app/conversation/conversation.module.ts`.
  - Beispiel: Nur MySQL Read‑Only aktivieren
    - `includeFunctionServices: [MysqlReadonlyService]`

- Ausführungslogik (`ConversationService`)
  - Per Name (inkl. Alias) auswählen → `validate` → `execute`.
  - Sonderfall `plugin_orchestrate`: System füllt Parameter; das Modell liefert nur `input`.

- Qualität und Zusammenarbeit
  - ESLint ignoriert ungenutzte Variablen mit Unterstrich‑Präfix; nützlich im Function‑Call‑Kontext.
  - Modulhinweise: `src/core/function-call/module.tip`.

## Spezifikation: KI‑gesteuerte Frontend‑Ausführung (Überblick)

- Aktion‑Benennungen: stabil und reproduzierbar, z. B. `openModal` / `updateTable` / `navigate`.
- Parameter‑Validierung: Typen und Pflichtfelder definieren; unkontrollierte Nebenwirkungen ablehnen.
- Idempotenz: Mehrfachausführung ohne widersprüchlichen Zustand; Transaktions‑Rollback unterstützen.
- Timeouts & Retry: Jede Aktion mit Timeout, Retry und Fallback.
- Sicherheit & Audit: Vollständige Protokollierung mit Kontext‑Snapshot.
- HookBus: Frontend‑/Backend‑Aktionen über den Bus integrieren, Reihenfolge und Konsistenz sicherstellen.

## Roadmap

- Direkte DB‑Ausführung (Schreiben)
  - Sicherer SQL‑Entry: Whitelist, Platzhalter‑Check, sensitive Workloads isolieren.
  - Rechte‑System: Rollen/ Mandantensteuerung mit Audit‑Logs.

- DB‑Sicherheit und Berechtigungen
  - Fein granulare Kontrolle auf Schema/ Tabelle/ Spalte.
  - Risikoerkennung, Management, Alarmierung und Rollback.

- Intelligente Plugin‑Generierung (Selbstwachstum)
  - Plan → Generate → Test → Publish.
  - Generierungs‑Constraints: Dependencies/Versionen/Lizenzen kontrollieren; tiefe Ketten vermeiden.

- Seitengenerierung basierend auf bestehenden Tabellen
  - CRUD‑Screens inkl. Routing und Berechtigungen automatisch erstellen.
  - Integration mit HookBus/Plugins (z. B. `plugins/customer-analytics`).

## Quick Start

1) Installieren & Build

```bash
npm install
npm run build
```

2) Aktivierte Services konfigurieren (`includeFunctionServices`)

3) Entwicklungsserver starten (sofern vorhanden)

```bash
npm run start:dev
```

Hinweis: Für lokale DB‑Entwicklung siehe `docker/mysql/init` und `.env`. Beginnen Sie mit `MysqlReadonlyService`; Schreibzugriffe erst aktivieren, wenn Rechte‑ & Audit‑Mechanismen stehen.
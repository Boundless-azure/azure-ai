# Projektüberblick (Mehrsprachiges README · Deutsch)

Sprachwechsel: [English](/docs/readme/README.en.md) · [Deutsch](/docs/readme/README.de.md) · [中文](/docs/readme/README.zh-CN.md)

Dieses Repository liefert eine pragmatische Plattform für KI-Dialoge und Function-Calls. Fokus: klare Semantik, einfache Erweiterbarkeit und kontrollierbares Verhalten. Wir setzen lieber um, was wirklich hilft – verständlich und anpassbar.

## Bereits umgesetzt

- Konversation mit nicht‑streamenden und streamenden Antworten
  - Non‑Streaming: `ConversationService.chat()`
  - Streaming (SSE‑artig): `ConversationService.chatStream()`

- Native Function‑Calls über Service‑Handles
  - Beschreibungen liegen unter `core/function-call/descriptions`; jeder Service stellt `getHandle()` mit `description/validate/execute` bereit.
  - Die Konversationsschicht injiziert `toolDescriptions` basierend auf aktivierten Services in die Modellanfrage.

- Verfügbare Function‑Call Services
  - `PluginOrchestratorService` → Funktion: `plugin_orchestrate`
    - Einstieg für „erst planen, dann generieren“ (Plugin‑Orchestrierung).
    - Das Modell liefert nur `input`; das System ergänzt `phase/modelId/temperature` automatisch.
  - `MysqlReadonlyService` → Funktion: `db_mysql_select`
    - Read‑only Abfragen. Validierung: `params` muss ein Array primitiver Werte (string/number/boolean/null) sein, `limit` ist Pflicht. Ausgabe: `Record<string, unknown>[]`.
  - `ContextFunctionService` → Funktion: `context_window_keyword`
    - Alias: `context_keyword_window`.

- Servicebasierter Schalter zur Funktionsregistrierung (bevorzugt)
  - Konfiguration: `src/app/conversation/conversation.module.ts`
  - Beispiel: nur MySQL Read‑only aktivieren

  ```ts
  import { AICoreModule } from '@core/ai';
  import { MysqlReadonlyService } from '@core/function-call';

  @Module({
    imports: [
      AICoreModule.forRoot({
        includeFunctionServices: [MysqlReadonlyService],
      }),
    ],
  })
  export class ConversationModule {}
  ```

- Ausführung in der Konversationsschicht
  - Funktion per Name (inkl. Alias) auflösen, `validate` ausführen, dann `execute`.
  - Spezialfall `plugin_orchestrate`: System ergänzt `phase/modelId/temperature`, das Modell liefert nur `input`.

- Nützliche Dateien
  - Modulhinweise: `src/core/function-call/module.tip`
  - Function‑Call Modul: `src/core/function-call/function-call.module.ts`
  - Funktionsbeschreibungen: `src/core/function-call/descriptions/`
  - Konversationsservice: `src/app/conversation/services/conversation.service.ts`
  - Konversationsmodul: `src/app/conversation/conversation.module.ts`
  - Optionen (inkl. `includeFunctionServices`): `src/core/ai/types/module.types.ts`

## Ausblick / Roadmap

- Direkte Ausführung von Datenbank‑Statements (Schreiboperationen)
  - Sicherer SQL‑Einstiegspunkt mit Whitelist, Placeholder‑Checks und Isolation sensibler Operationen.
  - Integriert mit Berechtigungen (Rollen/Mandanten) und Audit.

- Datenbanksicherheit und Berechtigungen
  - Feingranulare Kontrolle auf Schema/Tabellen/Spaltenebene.
  - Audit‑Trails und Risikokontrollen mit Alerts und Rollback‑Strategien.

- Intelligente Plugin‑Generierung
  - `plugin_orchestrate` wird zum Kreislauf: Plan → Code‑Generierung → Test → Veröffentlichung.
  - Nutzbare Prompt‑Tip‑Mechanismen für semantische Plugin‑Gerüste und Konfigurationen.

- Seiten aus bestehenden Tabellen generieren
  - Automatische CRUD‑Oberflächen mit Routing‑ und Berechtigungsbindung.
  - Integration mit HookBus/Plugins (z. B. `plugins/customer-analytics`) für einfache Erweiterungen.

## Schnellstart

1) Installieren und Build

```bash
npm install
npm run build
```

2) Aktivierte Services konfigurieren (`includeFunctionServices` wie oben gezeigt)

3) Dev‑Server starten (falls vorhanden)

```bash
npm run start:dev
```

> Tipp: Für lokale DB‑Entwicklung siehe `docker/mysql/init` und `.env`. Nutzen Sie zunächst `MysqlReadonlyService`; Schreiboperationen erst mit Berechtigungen und Audit aktivieren.
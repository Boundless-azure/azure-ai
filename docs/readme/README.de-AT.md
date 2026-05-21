# Azure AI (XiaoLan)

Sprachen: [English](/docs/readme/README.en.md) · [中文](/docs/readme/README.zh-CN.md)

## 🚀 Vision & Ziele

**"XiaoLan"** ist ein KI-Interaktionsportal der nächsten Generation, das entwickelt wurde, um traditionelle klickbasierte Web-Operationen durch Interaktionen in natürlicher Sprache zu ersetzen. Es ermöglicht Benutzern, Daten zu verwalten, Schnittstellen zu steuern und Geschäftslogik direkt durch Konversation auszuführen.

Kernfunktionen:
*   **Selbstwachstum**: Die KI generiert autonom Code-Plugins, die sich wieder in die Plattform integrieren und so eine kontinuierliche Verbesserungsschleife schaffen.
*   **Kontrollierte Generierung**: Verwendet "Generierungsbeschränkungen + Transaktionsbus (HookBus)", um sicherzustellen, dass KI-generierter Code sicher, abhängigkeitsarm und überprüfbar ist.
*   **KI-Ausführungsstandards**: Standardisierte Steuerungsprotokolle für Frontend-Komponenten, die es der KI ermöglichen, die Benutzeroberfläche präzise zu manipulieren.

## 🛠️ Technische Architektur

### 1. Frontend (Web-Client)
*   **Tech Stack**: Vue 3 (Composition API) + TypeScript + Tailwind CSS + Pinia.
*   **Modulares Design**:
    *   `Agent`-Modul: Kern der Chat-Interaktion.
    *   `IM`-Modul: Entkoppelte Benutzeroberfläche und Kommunikation über `useImChatAdapter`.
*   **Interaktionserlebnis**:
    *   **Multimodale Eingabe**: Sprachaufzeichnung (Echtzeit-Wellenform/Minimalistische UI), Text, Emoji, Bildvorschau, Dateiverarbeitung.
    *   **Intelligente Kontakte**: Automatische Gruppierung (KI-Agenten/Gruppen/Kontakte) mit Pinyin/Initialen-Sortierung.
    *   **Streaming-Antwort**: Volle SSE-Unterstützung mit Echtzeit-Markdown-Rendering.

### 2. Backend (Server)
*   **Service-Orchestrierung**: Modulare Dienste (basierend auf NestJS).
*   **Function Call**: Native LLM-Funktionsintegration mit dynamischer Tool-Injektion.
    *   `PluginOrchestratorService`: Plugin-Orchestrierung.
    *   `MysqlReadonlyService`: Sichere schreibgeschützte Datenbankabfragen.
*   **HookBus**: Der zentrale Bus, der Frontend-Aktionen und Backend-Logik verbindet und Ereigniskonsistenz und -reihenfolge gewährleistet.

## 📅 Roadmap

### ✅ Abgeschlossen (Phase 1: Fundament & Interaktion)
- [x] **Frontend-Framework**: Modulares Vue 3 + Tailwind Setup.
- [x] **Chat-Interaktion**: Streaming-Nachrichten-Rendering, Markdown-Unterstützung.
- [x] **Spracheingabe**: Minimalistische Aufnahme-UI mit Echtzeit-Lautstärke-Wellenform.
- [x] **Multimodale Unterstützung**: Emoji-Picker, Bildvorschau für Mobile/PC, Dateisystemintegration.
- [x] **Intelligentes Adressbuch**: Gruppierungsstrategie (KI-Agenten > Gruppen > Kontakte) und Pinyin-Sortierung.
- [x] **Internationalisierung**: i18n-Unterstützung.

### 🚧 In Arbeit (Phase 2: Kern-KI-Fähigkeiten)
- [ ] **DB-Schreiboperationen**: Sichere SQL-Ausführung mit Whitelisting und Auditing.
- [ ] **Granulare Berechtigungen**: Zugriffskontrolle auf Zeilen-/Spaltenebene.
- [ ] **HookBus-Integration**: Einheitlicher Bus für Frontend-Backend-Aktionen.
- [ ] **Selbstwachstumsschleife**: "Planen -> Generieren -> Testen -> Bereitstellen" Workflow.

### 🔮 Zukunft (Phase 3: Tiefe Integration)
- [ ] **Auto-CRUD**: Generierung von Verwaltungsseiten aus dem DB-Schema.
- [ ] **Multi-Agenten-Kollaboration**: Komplexe Aufgabenorchestrierung.
- [ ] **Geschäfts-Plugins**: Kundenanalysen, automatisierte Berichte usw.

## 🚦 Schnellstart

1. **Abhängigkeiten installieren**
```bash
npm install
```

2. **Entwicklungsserver starten**
```bash
npm run dev
```

3. **Für Produktion bauen**
```bash
npm run build
```

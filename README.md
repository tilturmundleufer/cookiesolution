# Cookie Solution

DSGVO-konforme Cookie-Einwilligungslösung mit Consent-Tracking, Kategorie-Auswahl und Webhook-Integration für Make.com.

## Make.com Webhook-Setup

Für DSGVO-konformes Consent-Tracking kann jeder Consent-Wechsel an einen Webhook gesendet werden (z.B. Make.com → Google Sheets, Airtable, Datenbank).

### 1. Webhook in Make.com erstellen

1. Neues Scenario in Make.com anlegen
2. Modul **Webhooks** → **Custom webhook** hinzufügen
3. Webhook-URL kopieren (z.B. `https://hook.eu1.make.com/xxxxxxxx`)

### 2. Webhook-URL konfigurieren

**Option A: Über Script-Tag (z.B. Webflow)**

```html
<script src="https://cookiesolution.vercel.app/cookie-solution.js" 
        data-cs-webhook="https://hook.eu1.make.com/DEINE-WEBHOOK-ID" 
        defer></script>
```

**Option B: Direkt in cookie-solution.js**

In `CONFIG` den Wert setzen:

```javascript
webhookUrl: "https://hook.eu1.make.com/DEINE-WEBHOOK-ID"
```

> **Sicherheit:** Webhook-URL nicht im öffentlichen Frontend-Code hardcoden, wenn möglich. Bei Webflow/statischen Sites die URL über `data-cs-webhook` setzen und ggf. pro Domain unterschiedliche Webhooks nutzen.

### 3. Webhook-Payload

Bei jeder Consent-Änderung wird ein POST mit folgendem JSON gesendet:

```json
{
  "ts": 1707753600000,
  "action": "accept_all|reject_all|save_selection",
  "consent": {
    "essential": true,
    "analytics": true,
    "functional": false,
    "marketing": false
  },
  "version": "1.0.0",
  "region": "EU",
  "domain": "example.com"
}
```

| Feld | Beschreibung |
|------|--------------|
| `ts` | Unix-Timestamp (ms) der Einwilligung |
| `action` | `accept_all`, `reject_all` oder `save_selection` |
| `consent` | Aktueller Zustand pro Kategorie |
| `version` | Version der Cookie Solution |
| `region` | Region (z.B. EU, UK, CH) |
| `domain` | Domain, auf der das Banner angezeigt wurde |

### 4. Make.com Scenario vervollständigen

- Nach dem Webhook-Modul: **Google Sheets** / **Airtable** / **Datenbank** hinzufügen
- Daten aus dem Webhook-Payload in die gewünschten Spalten mappen
- Scenario aktivieren

### 5. Retention

- **Client-seitig:** Consent-Log im localStorage wird automatisch auf 3 Jahre begrenzt (`CONFIG.consentLogRetentionDays`).
- **Server-seitig:** In Make.com oder der Ziel-Datenbank die Aufbewahrungsfrist für DSGVO-Nachweispflicht konfigurieren (typisch: 3 Jahre).

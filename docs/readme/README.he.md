# Xiaolan (סקירת פרויקט · עברית)

החלפת שפה: [English](/docs/readme/README.en.md) · [Deutsch](/docs/readme/README.de.md) · [中文](/docs/readme/README.zh-CN.md) · [עברית](/docs/readme/README.he.md) · [ไทย](/docs/readme/README.th.md) · [Deutsch (Österreich)](/docs/readme/README.de-AT.md)

## מיצוב ומטרות

1. שם הפרויקט: “Xiaolan”.
2. נקודת כניסה חדשה לאינטראקציה: החלפת מודל הווב הישן המבוסס‑קליקים ב‑AI, כך שמשתמשים מנהלים ממשק או נתונים בשפה טבעית.
3. יכולת צמיחה עצמית: ה‑AI מייצר תוספי קוד שמוזנים חזרה לפלטפורמה, לולאת יכולות מתרחבת באופן רציף.
4. מגבלות יצירה + אוטובוס טרנזאקציות (HookBus): מבטיחים קוד בעל תלות נמוכה ומעט קינון, קוד ארגוני נשלט ובר‑בקרה.
5. מפרט ביצוע רכיבי Frontend עבור AI: מאפשר ל‑AI לשלוט ישירות בקומפוננטים באופן צפוי, מתועד וניתן למעקב.

## התקדמות נוכחית (מה עובד עכשיו)

- שיחה וזרימה
  - לא זורם: `ConversationService.chat()`
  - זורם (דמוי SSE): `ConversationService.chatStream()`

- אינטגרציית function‑call מקורית דרך שירותים
  - תיאורים תחת `src/core/function-call/descriptions/`; כל שירות חושף `getHandle()` עם `description/validate/execute`.
  - שכבת השיחה מזריקה `toolDescriptions` לפי שירותים פעילים (function‑call מקורי של המודל).

- שירותי function‑call זמינים
  - `PluginOrchestratorService` → פונקציה: `plugin_orchestrate`
    - נקודת כניסה ל„תכנן קודם, הפק אחר כך”.
    - המודל מספק רק `input`; המערכת משלימה `phase/modelId/temperature`.
  - `MysqlReadonlyService` → פונקציה: `db_mysql_select`
    - שאילתות קריאה. ולידציה: `params` חייב להיות מערך ערכים פרימיטיביים (string/number/boolean/null), ו‑`limit` נדרש. פלט: `Record<string, unknown>[]`.
  - `ContextFunctionService` → פונקציה: `context_window_keyword`
    - שם חלופי נתמך: `context_keyword_window`.

- מפסק רישום מבוסס שירות (מומלץ)
  - קונפיגורציה: `src/app/conversation/conversation.module.ts`.
  - דוגמה: הפעלת MySQL לקריאה בלבד
    - `includeFunctionServices: [MysqlReadonlyService]`

- תזרימי ביצוע (`ConversationService`)
  - פתירה לפי שם (עם חלופה לשם חלופי), להריץ `validate`, ואז `execute`.
  - מקרה מיוחד: `plugin_orchestrate` → המערכת משלימה פרמטרים; המודל מספק רק `input`.

- איכות ושיתוף פעולה
  - ESLint מוגדר להתעלם ממשתנים לא בשימוש עם קידומת קו‑תחתי; שימושי בהקשרי function‑call.
  - טיפים מודולאריים: `src/core/function-call/module.tip`.

## מפרט ביצוע רכיבי Frontend ע״י AI (סקירה)

- שמות פעולות: יציבים וברי‑השמעה, למשל `openModal` / `updateTable` / `navigate`.
- ולידציית פרמטרים: סוגים ושדות נדרשים מוגדרים; דחיית פרמטרים עם תופעות לוואי לא מתועדות.
- אידמפוטנטיות: ריצות חוזרות לא יובילו למצב שונה; תמיכה ב‑rollback טרנזאקציוני.
- Timeout & Retry: לכל הרצה יש טיימאאוט, נסיונות חוזרים ומסלולי נפילה.
- אבטחה ובקרה: כל הרצה מתועדת ביומן עם צילום מצב ההקשר.
- HookBus: איחוד פעולות Front/Back על האוטובוס לשמירת סדר ועקביות.

## מפת דרכים / מה הלאה

- הרצת הצהרות DB ישירות (כתיבה)
  - כניסת SQL מאובטחת: רשימות לבנות, בדיקות placeholder, בידוד פעולות רגישות.
  - אינטגרציה להרשאות: שליטה לפי תפקיד/דייר, עם בקרה ואודיט.

- אבטחת DB והרשאות
  - שליטה גרעינית ברמת סכימה/טבלה/עמודה.
  - אודיט וניהול סיכונים עם התראות ו‑rollback.

- יצירת פלאגינים חכמה (חיזוק הצמיחה העצמית)
  - תכנון → יצירת קוד → בדיקות → פרסום.
  - מגבלות יצירה: שליטת כמות תלות, גרסאות ורישיונות; הימנעות מקינון עמוק.

- יצירת דפים מטבלאות קיימות
  - CRUD אוטומטי עם ניתוב והרשאות.
  - אינטגרציה עם HookBus/Plugins (למשל `plugins/customer-analytics`).

## תחילת עבודה (Quick Start)

1) התקנה ובנייה

```bash
npm install
npm run build
```

2) קונפיגורציה של שירותים פעילים (`includeFunctionServices`)

3) הפעלת שרת פיתוח (אם קיים)

```bash
npm run start:dev
```

טיפ: לפיתוח DB מקומי, ראו `docker/mysql/init` ו‑`.env`. בהתחלה העדיפו `MysqlReadonlyService`; הפעלת כתיבות רק לאחר שהרשאות ואודיט מוכנים.
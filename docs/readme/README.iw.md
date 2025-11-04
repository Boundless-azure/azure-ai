# Xiaolan (סקירת פרויקט · עברית)

החלפת שפה: [עברית](/docs/readme/README.iw.md) · [English](/docs/readme/README.en.md) · [Deutsch](/docs/readme/README.de.md) · [Deutsch (Österreich)](/docs/readme/README.de-AT.md) · [中文](/docs/readme/README.zh-CN.md) · [ไทย](/docs/readme/README.th.md)

## מיצוב ומטרה

1. שם הפרויקט: "Xiaolan".
2. צורת אינטראקציה חדשה: בינה מלאכותית מחליפה את מודל ה-Web הקלאסי של קליקים; המשתמשים שולטים ב-UI ובמידע בשפה טבעית.
3. יכולת צמיחה עצמית: ה-AI מייצר תוספי קוד (Plugins) שמוחזרים למערכת – מחזור יכולות מתמשך.
4. מגבלות יצירה + אוטובוס טרנזקציות (HookBus): קוד בעל תלות נמוכה, נשלט ובר-ביקורת – מתאים לארגונים.
5. מפרט לשליטה בקומפוננטות פרונטאנד ע"י AI: שליטה ישירה, צפויה וברת-בדיקה.

## מצב נוכחי (מימושים קיימים)

- שיחה וזרימה (Streaming)
  - ללא זרימה: `ConversationService.chat()`
  - זרימה (בדומה ל-SSE): `ConversationService.chatStream()`

- Function‑Call טבעי דרך Services
  - תיאור ב-`src/core/function-call/descriptions/`; כל Service מספק `getHandle()` עם `description/validate/execute`.
  - שכבת השיחה מוסיפה `toolDescriptions` לפי השירותים הפעילים (כלי טבעי של המודל).

- שירותי Function‑Call זמינים
  - `PluginOrchestratorService` → פונקציה: `plugin_orchestrate`
    - נקודת פתיחה ל"תכנון תחילה, יצירה לאחר מכן".
    - המודל שולח רק `input`; המערכת משלימה `phase/modelId/temperature`.
  - `MysqlReadonlyService` → פונקציה: `db_mysql_select`
    - שאילתות קריאה בלבד; ולידציה: `params` חייב להיות מערך של ערכים פרימיטיביים (string/number/boolean/null) וחובה `limit`. החזרה: `Record<string, unknown>[]`.
  - `ContextFunctionService` → פונקציה: `context_window_keyword`
    - כינוי: `context_keyword_window`.

- רישום מבוסס שירות (מומלץ)
  - קונפיגורציה ב-`src/app/conversation/conversation.module.ts`.
  - דוגמה: הפעלת MySQL קריאה בלבד
    - `includeFunctionServices: [MysqlReadonlyService]`

- לוגיקת ביצוע (`ConversationService`)
  - בחירה לפי שם (כולל כינויים) → `validate` → `execute`.
  - מקרה מיוחד `plugin_orchestrate`: המערכת משלימה פרמטרים; המודל מספק רק `input`.

- איכות ושיתוף פעולה
  - ESLint מתעלם ממשתנים לא בשימוש שמתחילים בקו תחתון; שימושי בהקשר Function‑Call.
  - הערות מודול: `src/core/function-call/module.tip`.

## מפרט: ביצוע פרונטאנד מונחה AI (סקירה)

- שמות פעולות: יציבים וברי-שחזור, לדוגמה `openModal` / `updateTable` / `navigate`.
- ולידציית פרמטרים: הגדרת טיפוסים ושדות חובה; דחיית תופעות לוואי ללא בקרה.
- Idempotency: הרצה חוזרת ללא מצב סותר; תמיכה ב-Rollback טרנזקציוני.
- Timeouts ו-Retry: לכל פעולה זמן קצוב, נסיונות חוזרים ו-Fallback.
- אבטחה ובקרה: לוג מלא עם צילום מצב הקשר.
- HookBus: אינטגרציה של פעולות פרונט/בק דרך Bus, שמירת סדר ועקביות.

## מפת דרכים

- ביצוע ישיר במסד נתונים (כתיבה)
  - Entry SQL מאובטח: רשימת לבנה, בדיקת Placeholder, בידוד עבודות רגישות.
  - מערכת הרשאות: שליטה לפי תפקיד/דייר, עם לוגים לבקרה.

- אבטחת DB והרשאות
  - שליטה עדינה ברמת סכימה/טבלה/עמודה.
  - זיהוי סיכונים, ניהול, התרעות ו-Rollback.

- יצירת Plugins חכמה (צמיחה עצמית)
  - Plan → Generate → Test → Publish.
  - מגבלות יצירה: שליטה ב-Dependencies/גרסאות/רישיונות; הימנעות משרשראות עמוקות.

- יצירת דפים לפי טבלאות קיימות
  - יצירת מסכי CRUD אוטומטית עם Routing והרשאות.
  - אינטגרציה עם HookBus/Plugins (למשל `plugins/customer-analytics`).

## Quick Start

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

הערה: לפיתוח DB מקומי ראו `docker/mysql/init` ו-`.env`. מומלץ להתחיל עם `MysqlReadonlyService`; לאפשר כתיבה רק לאחר הטמעת הרשאות ובקרה.
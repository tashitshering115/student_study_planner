# Student Study Planner

A full-stack student study planner built with Node.js, Express, EJS, Bootstrap and PostgreSQL. This version includes same-day web push notifications for pending tasks.

## Features

- Student registration and login (bcrypt password hashing)
- PostgreSQL-backed login sessions
- Student-owned subjects, tasks and study sessions (create, view, edit and delete)
- Dashboard with task statistics and upcoming work
- Browser push notifications on subscribed devices
- Same-day reminder for each pending task due today, sent at 8:00 AM Bhutan time by default
- A dashboard button to enable notifications and a test-notification button

## Requirements

- Node.js 18 or newer
- PostgreSQL 13 or newer
- npm
- A supported browser (Chrome or Edge recommended)
- HTTPS for deployed sites; localhost is allowed for local testing

## 1. Extract and open the project

Extract the ZIP and open the inner `student-study-planner` folder in VS Code.

## 2. Create the PostgreSQL database

In pgAdmin, connect to your PostgreSQL server, select the `postgres` database, open Query Tool and run:

```sql
CREATE DATABASE student_study_planner;
```

The application creates its tables automatically, including the push-subscription and reminder-log tables.

## 3. Configure environment variables

In the VS Code terminal, run:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set your own PostgreSQL password and a long random session secret. Do not share this file or upload it to GitHub.

Example:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/student_study_planner
SESSION_SECRET=replace-with-a-long-random-secret

VAPID_PUBLIC_KEY=PASTE_PUBLIC_KEY_HERE
VAPID_PRIVATE_KEY=PASTE_PRIVATE_KEY_HERE
VAPID_SUBJECT=mailto:you@example.com

REMINDER_HOUR=8
REMINDER_MINUTE=0
```

If your database password contains URL-special characters such as `@`, `#`, `/` or `:`, URL-encode those characters in `DATABASE_URL`.

## 4. Install dependencies

```powershell
npm install
```

This installs `web-push` along with the application's other packages.

## 5. Generate the push notification keys

Run:

```powershell
npx web-push generate-vapid-keys
```

The command prints a **Public Key** and a **Private Key**. Copy them into `.env`:

- Put the Public Key after `VAPID_PUBLIC_KEY=`.
- Put the Private Key after `VAPID_PRIVATE_KEY=`.
- Keep `VAPID_PRIVATE_KEY` secret. Never put it in frontend JavaScript or GitHub.

Keep `VAPID_SUBJECT=mailto:you@example.com`, replacing the example with an email address you control.

## 6. Start the application

```powershell
npm run dev
```

Open:

http://localhost:3000

Register or log in to your student account.

## 7. Enable notifications on a device

1. Open the dashboard in Chrome or Edge.
2. Click **Enable notifications**.
3. When the browser asks, choose **Allow**.
4. Wait for the dashboard to confirm that this device is subscribed.
5. Click **Send test**. You should receive a test notification.
6. Repeat these steps on your phone to subscribe that device too.

Each browser/device needs its own permission and subscription. For a phone, open the deployed HTTPS website in its browser. On iPhone, add the website to the Home Screen first, then open the web app and enable notifications (iOS/iPadOS 16.4 or later).

## 8. How same-day reminders work

- The server checks the database once per minute.
- At the configured time (default 8:00 AM, `Asia/Thimphu` / Bhutan time), it finds tasks whose due date is today and whose status is not `Completed`.
- It sends a push notification to every device subscribed by that student.
- A database reminder log prevents the same task from being sent repeatedly on the same date.
- If the server is stopped at the reminder time, reminders are checked when it starts again that day.
- The server must remain running for scheduled reminders to be sent. A free hosting service that sleeps or stops the app cannot guarantee exact-time delivery.

To change the reminder time, edit `REMINDER_HOUR` and `REMINDER_MINUTE` in `.env`, then restart the server. Example: `REMINDER_HOUR=9` and `REMINDER_MINUTE=30` sends at 9:30 AM Bhutan time.

## 9. Test a real due-today reminder

For a safe test:
1. Create a task and set its due date to today's date.
2. Leave its status as `Pending` or `In Progress`.
3. Enable notifications and use **Send test** to verify the device subscription.
4. For immediate scheduler testing, temporarily set `REMINDER_HOUR=0` and `REMINDER_MINUTE=0` in `.env`, restart the server, and wait up to one minute. Restore the normal time afterwards.

The reminder log ensures one reminder per task per date. To test the same task again on the same day, delete its test log row in pgAdmin:

```sql
DELETE FROM task_reminder_log
WHERE task_id = YOUR_TASK_ID
  AND reminder_date = CURRENT_DATE;
```

## 10. GitHub and deployment safety

- Do not commit `.env`, private VAPID keys, database passwords or session secrets.
- Configure all environment variables in your hosting provider's dashboard.
- Use HTTPS in production.
- The application process must stay awake for scheduled reminders. Configure a persistent Node.js web service and a managed PostgreSQL database.
- For multiple server instances, move scheduled jobs to a single dedicated worker or external scheduler to avoid timing/race issues.

## Troubleshooting

- **Notifications not supported:** use a current Chrome or Edge browser.
- **Permission denied:** change the site's notification permission in browser settings.
- **Not secure:** use `http://localhost` for local testing or HTTPS for deployed testing.
- **VAPID key error:** generate keys and copy both into `.env`, then restart the server.
- **Test notification fails:** confirm the device allowed notifications and click Enable notifications again.
- **No due reminder:** check the task date, ensure it is not Completed, verify server is running and confirm the reminder time is configured in Bhutan time.

## Important

This is a learning and coursework project. Before production use, add CSRF protection, rate limiting, account recovery, email verification, secure deployment configuration, backups and monitoring.

## SQL file and Render deployment

- Standalone PostgreSQL schema: `database/schema.sql`.
- Render deployment instructions: `RENDER_DEPLOYMENT.md`.
- The application also creates/updates its required tables automatically on startup through `config/initDb.js`; create the database itself before starting the app.

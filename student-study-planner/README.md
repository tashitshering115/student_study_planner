# Student Study Planner

A working full-stack student planner built with Node.js, Express 5, EJS, Bootstrap 5 and PostgreSQL.

## Features
- Student registration and login (bcrypt password hashing)
- Session-based authentication stored in PostgreSQL
- Each student can only access their own records
- Subject CRUD (create, read, update, delete)
- Task CRUD with due date, priority and status
- Study-session CRUD with date and time validation
- Dashboard with subject/task counts, upcoming tasks, sessions and completion percentage
- Responsive Bootstrap interface

## Requirements
- Node.js 18 or newer
- PostgreSQL 13 or newer
- npm

## 1. Create the database
Open pgAdmin, connect to your PostgreSQL server, open Query Tool and run:

```sql
CREATE DATABASE student_study_planner;
```

Do not create the tables manually. The application creates its tables automatically at startup.

## 2. Configure environment
In the project folder, copy `.env.example` to `.env`.

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

Open `.env` and replace `YOUR_PASSWORD` in `DATABASE_URL` with your PostgreSQL password. Also replace the session secret with a long random value.

Example:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:MyPassword@localhost:5432/student_study_planner
SESSION_SECRET=a-long-random-secret-value-change-this
```
If your password contains characters such as `@`, `#`, `/`, or `:`, URL-encode those characters in the connection URL.

## 3. Install packages
Open a terminal in this project folder:
```bash
npm install
```

## 4. Start the application
Development mode:
```bash
npm run dev
```
Or normal mode:
```bash
npm start
```

Open http://localhost:3000 and create your student account.

## 5. How to use
1. Register a new account.
2. Add subjects.
3. Add tasks and assign them to subjects.
4. Create study sessions.
5. Update task status and see dashboard progress.

## Important notes
- This project is a local development starter. Before public deployment, add CSRF protection, rate limiting, email verification/password reset, stronger production session settings, HTTPS, backups and deployment-specific database SSL settings.
- Bootstrap is loaded from a CDN, so an internet connection is needed for the styling.
- Do not share your `.env` file or PostgreSQL password.
- The database tables are created automatically by `config/initDb.js`.

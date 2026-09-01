# Adeeb Online Attendance System

A deployable teacher attendance platform using React, TypeScript, Express, Mongoose, and MongoDB. The frontend is prepared for Vercel and the API for Render.

## Features

- Teacher registration with a designation such as Teacher or CR, required phone, city, and institution name (school, college, or university), plus secure sign-in using bcrypt password hashing and an expiring JWT in an `HttpOnly` cookie
- Account passwords may be any length, including one character, but cannot be empty or contain only whitespace.
- Strict ownership checks: teachers can access only their own classes, students, and attendance
- Class management with Morning/Evening timing, plus student roll number, contact, and guardian fields
- Date-specific attendance for current or past dates with Present, Absent, and Leave controls
- Existing attendance can be reopened and corrected
- Server-generated PDF attendance reports
- Admin-only overview, teacher account editing, total counts, and per-class enrolment
- Input validation, rate-limited authentication, origin checks, secure headers, and production environment validation

## Project structure

```text
frontend/   React + Vite application (Vercel)
backend/    Express + Mongoose API (Render)
render.yaml Render Blueprint
```

The supplied `Adeeb Online Attendance System logo.png` is retained at the project root and copied to `frontend/public/logo.png` for application branding.

## Local development

Requirements: Node.js 20+ and a MongoDB database.


```
cd backend
npm install
npm run dev

cd frontend
npm install
npm run dev
```



1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Copy `backend/.env.example` to `backend/.env`. Set:

   - `MONGODB_URI` to the private MongoDB connection URI
   - `JWT_SECRET` to at least 32 random characters
   - `CLIENT_URL=http://localhost:5173`

3. The frontend uses `/api` by default and Vite proxies it to `http://localhost:4000`. A frontend environment file is not required locally.

4. Start both applications:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`.

Never commit `backend/.env`; all `.env` files are ignored. The MongoDB URI file mentioned during development was not visible in this delegated workspace, so no database credential has been added to this repository.

## Create the first administrator

Add `ADMIN_NAME`, `ADMIN_EMAIL`, and a non-blank `ADMIN_PASSWORD` to `backend/.env`, then run:

```bash
npm run seed:admin
```

This safely creates or updates that email as an administrator. Remove the admin password from the local environment when it is no longer needed.

## Verification

```bash
npm test
npm run build
```

The build produces `backend/dist` and `frontend/dist`.

## Deploy the backend to Render

The root `render.yaml` defines the service. Connect the repository to Render using a Blueprint, or create a Web Service with:

- Root directory: `backend`
- Runtime: Node
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Health check: `/api/health`

Set these Render secrets/environment values:

- `NODE_ENV=production`
- `MONGODB_URI` — the MongoDB Atlas/private connection URI
- `JWT_SECRET` — a strong random value (Render Blueprint can generate it)
- `CLIENT_URL` — the final Vercel origin, such as `https://attendance.example.com`, with no trailing slash

Allow the Render service to reach the MongoDB deployment using the database provider's network-access settings. Do not place the URI in `render.yaml`.

To create the production admin, temporarily add `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` to Render, open a Render shell, run `npm run seed:admin`, then remove `ADMIN_PASSWORD`.

## Deploy the frontend to Vercel

1. Import the repository and set the Vercel Root Directory to `frontend`.
2. Build command: `npm run build`; output directory: `dist`.
3. In `frontend/vercel.json`, replace `https://YOUR-RENDER-SERVICE.onrender.com` with the actual HTTPS Render service origin before deploying.
4. Keep API calls on `/api`; the Vercel rewrite makes authentication cookies first-party and proxies API requests to Render.
5. Set Render's `CLIENT_URL` to the deployed Vercel origin and redeploy the API.

The second rewrite in `frontend/vercel.json` provides SPA route fallback for direct visits to dashboard pages.

## Data model and authorization

- `User` owns many classes and has either the `TEACHER` or `ADMIN` role.
- New user records use `designation`; legacy stored `department` values are read as designations and migrated when edited.
- Teacher signup and admin profile editing require a phone number containing 7–15 digits. Legacy accounts without a phone remain readable but must add one on their next edit.
- City and Institution Name are required for new teachers and admin profile edits. Legacy accounts missing either field remain readable and must complete them on their next edit.
- `Class` references its teacher.
- `Student` belongs to one class; roll numbers are unique within a class.
- `Attendance` belongs to a class and student; one record exists per student and calendar date.

Every teacher API query includes the authenticated teacher ID when resolving the class. Student and attendance endpoints first verify class ownership, which prevents cross-account identifier access. Admin routes use separate role-protected endpoints.

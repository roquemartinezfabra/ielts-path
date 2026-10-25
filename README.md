# IELTS Path

An independent study application for **IELTS General Training**: learn the foundations, practise Reading and Writing, review mistakes and track progress. Theory is in English with Spanish support. The interface is primarily Spanish.

The study target is **7.5 or higher in each skill**. Practice scores and tutor estimates are not official IELTS results or a guarantee of a particular band.

## What you can do

- Follow a foundation course, lesson by lesson: theory, uses, examples, guided practice, checks and a short application.
- Practise Reading and Writing with timers, explicit submission, drafts and an option to leave without saving.
- Keep original answers, feedback, rewrites and dated reports with links back to the relevant theory.
- Use the existing flashcard module with CSV import, FSRS scheduling and a separate backup.
- Export attempts for a tutor, then import structured feedback in **Informes**. Closed exercises are marked automatically; open writing needs a tutor or a compatible AI service.
- Export personal backups, results and a clean source archive. Each learner has separate server-side storage.

Listening and Speaking can be recorded as external practice. They do not have full in-app examination engines. The practice materials are original or linked to their sources; they are not official calibrated IELTS papers.

## Run locally

Requirements: **Node.js 22.13+**, npm and **Python 3.9+** available as `python` (for the source archive).

```sh
npm ci
npm run db:local
npm run dev
```

Open **http://127.0.0.1:5174/** and choose **Probar como invitado**. No ChatGPT, GitHub or Cloudflare account is required for local guest use. Keep `.wrangler/state/` to retain local data.

```sh
npm run check
npm run build
npm run preview
```

Stop the development server before starting the preview on the same port. The production build regenerates the downloadable source archive.

## Host your own copy

This server application uses **Cloudflare Workers and D1**. GitHub stores the source; GitHub Pages alone cannot run its database and account routes.

The [installation guide](docs/GUIA-INSTALACION.md) covers Cloudflare setup, database migrations, deployment, optional GitHub login and moving your own progress from the original Site. You will need your own hosting account. Check the provider's current limits and pricing before enabling paid services.

- **Guest:** separate browser session, valid for up to 30 days. Export a backup before clearing cookies or ending the session if you want to keep access to those results.
- **GitHub login (optional):** stable account identity across devices. Configure your own OAuth application. No repository or email permissions are requested.
- **Tutor connection (optional):** a revocable, short-lived token for compatible MCP clients. It does not automatically connect this application to a ChatGPT conversation. Export/import works without that integration.

No personal learning records or original hosting identity are included. Importing a backup is an explicit action. The original Site and this deployment have separate databases.

## Implementation and checks

React + TypeScript, Vinext/Vite, a Cloudflare Worker, D1/SQLite, and `ts-fsrs`. Sessions are stored as token hashes; cookies are HttpOnly, SameSite and Secure on HTTPS. State changes validate the request origin and protect against overwriting a newer revision. GitHub sign-in uses OAuth state and PKCE.

Checks cover lesson content, course progression, scheduling, imports, database persistence, user isolation, session expiry, CSRF protection and tutor feedback. OAuth provider responses are mocked in automated tests; a deployed OAuth application still needs an end-to-end check with its real callback URL.

GitHub Actions runs the checks and production build on pushes and pull requests. A successful local build does not mean the application has been deployed.

## Learning evidence and sharing

The [methodology](docs/METODOLOGIA.md) separates first attempts, assisted practice, repetitions, rewrites and declared official results. The [research notes](docs/INVESTIGACION.md) explain the educational decisions and their limits.

The [results and LinkedIn template](docs/RESULTADOS-Y-LINKEDIN.md) is intentionally unfilled until real exam results are available. It does not invent outcomes or attribute improvement solely to this application.

## Licence

Original contributions are available under [MIT](LICENSE). Preserve third-party notices and dependency licences. Linked official texts and IELTS trademarks are not relicensed by this project. IELTS Path is independent and is not endorsed by the examination bodies.

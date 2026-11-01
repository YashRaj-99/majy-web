# MAJY Academy — files to add to `majy-web`

This package adds a separate Academy at `https://majy.in/academy/` while retaining the existing corporate homepage and Skyline game.

## Files in this package

Copy the contents of this package into the root of your existing `majy-web` repository. It adds:
- `src/worker.js` — API routes, D1 lesson publishing, Cron handler; all other requests are passed to the existing static asset binding.
- `public/academy/` — independent Academy pages, CSS and browser JavaScript.
- `migrations/0001_academy_init.sql` — D1 schema and the seven dated lessons/quizzes.
- `wrangler.jsonc` — updated Worker configuration (merge with your existing config; see below).

## Important: do not deploy the placeholder D1 ID

1. In Cloudflare Dashboard → Workers & Pages → D1 SQL Database, create a database named `MAJY_Academy_DB`.
2. Copy its database ID.
3. In `wrangler.jsonc`, replace `REPLACE_WITH_YOUR_CLOUDFLARE_D1_DATABASE_ID` with that exact ID.
4. Install/use Wrangler in the repository environment.
5. Apply the migration remotely:
   `npx wrangler d1 migrations apply MAJY_Academy_DB --remote`
6. Deploy:
   `npx wrangler deploy`

## GitHub upload

Upload the files/folders to the repository root, preserving their paths. The supplied `wrangler.jsonc` is a replacement configuration including the current Worker name, compatibility date and static assets directory plus the new Worker, D1 binding and Cron trigger. If your live config has changed since the handover, merge the new settings rather than overwriting newer settings.

Recommended: create a branch in GitHub named `feature/majy-academy`, add these files there, then open a Pull Request to `main`. Do not commit the placeholder D1 ID.

## Daily publication

The Cron expression `30 2 * * *` runs at 02:30 UTC, which is 08:00 India Standard Time. The scheduled handler publishes any lesson whose `publish_date` is today or earlier in Asia/Kolkata. The API also performs the same due-publication check when a learner opens the dashboard, so a delayed Cron run does not keep a due lesson hidden.

The seven lessons are dated 3–9 November 2026. They are preloaded as `scheduled`; the first one becomes available at 08:00 IST on 3 November 2026.

## Progress and privacy

Quiz answers are graded by the Worker, so the answer key is not sent with the quiz questions. Course progress and scores are saved in the learner's current browser using `localStorage`. This is suitable for an initial single-learner course but is not cross-device, multi-user or tamper-proof. A future learner login and server-side progress table should be added before opening the Academy to multiple learners.

## Verify before launch

- Confirm `/` still shows the corporate website.
- Confirm `/games/skyline/` still works.
- Confirm `/academy/` loads.
- Before 08:00 IST on 3 Nov, lessons should show as locked.
- After the scheduled time, Day 1 should be available.
- Complete the quiz and confirm the score appears on the dashboard after returning.
- Check Cloudflare Worker logs and D1 migration status if an API error appears.

## Course safety note

This is educational material, not investment advice or a promise of trading returns. The sample risk figures are illustrative research settings, not personal recommendations. Verify current SEBI, exchange and broker requirements before deploying any live retail algorithm.

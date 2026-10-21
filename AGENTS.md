<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Visitor tracking enters only via public routes `/api/public/track` and `/api/public/tracker.js`; the track handler validates input and writes with the admin client because visitors are anonymous.
- Dashboard data is read in the browser through RLS restricted to `has_role(admin)`; roles are granted by an auth trigger (allow-listed initial emails become super_admin).
- Step matching, session status windows and UA parsing live in `src/lib/tracking.ts` (pure, unit-tested) so the API and UI share one definition.
- Live screens refresh via realtime on `sessions`/`events` (debounced query invalidation), not polling alone.
- Roles: super_admin(4) > admin(3) > analyst(2) > viewer(1) via `user_role_level`; RLS uses `can_view`/`can_manage`, privileged ops live in `src/lib/admin.functions.ts` and re-check the role server-side.
- Integration secrets (TikTok token, Digistore webhook token/passphrase) live in `integration_secrets`, reachable only by service role; UI sees masked hints.
- TikTok events go through `event_queue` (`src/lib/server/ops.ts`): sent immediately after enqueue, retried by a 15-min cron with exponential backoff, dead-lettered after MAX_ATTEMPTS.
- Digistore24 IPN is deduped by `webhook_events.dedupe_key`; only `approved` sales enqueue CompletePayment.
- Public checkout links embed the product's native Digistore24 order form without a widget override or platform branding so the seller's existing design is preserved; payment fields remain provider-owned, and manager-only link creation validates account ownership server-side.

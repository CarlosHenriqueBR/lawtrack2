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
- Dashboard data is read in the browser through RLS restricted to `has_role(admin)`; admins are granted by an auth trigger (first user plus an email allow-list in the migration).
- Step matching, session status windows and UA parsing live in `src/lib/tracking.ts` (pure, unit-tested) so the API and UI share one definition.
- Live screens refresh via realtime on `sessions`/`events` (debounced query invalidation), not polling alone.

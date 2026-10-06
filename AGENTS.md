# AGENTS
- All client activity (arm, disarm, trigger, maintenance, observation) lives in one `client_events` table keyed by `kind`; bypasses are a separate table because they have a start/end lifespan. Why: plantão and weekly report read the same rows, so shift entries feed the report automatically.
- Data access uses the browser Lovable Cloud client with RLS (team-wide access for authenticated operators); admin-only actions go through security-definer RPCs. Why: internal team tool, no public data.
- Pure formatting/report logic (week ranges, WhatsApp message, CSV) lives in `src/lib/safenet.ts` with tests. Why: keeps rules testable.
- Permissions: roles in `user_roles` (operator, manager = "cadastros", admin); `can_manage()` gates inserts/updates of registrations and custom fields via RLS, deletes are admin-only on every table. Why: three-level access the team requested, enforced in the database.
- Registrations (clients, users, devices, sensors) are soft-deleted with `active=false`, and events/bypasses store name snapshots (`sensor_labels`, `sensor_label`). Why: renaming or removing items never erases or alters history.
- Admin-defined extra fields live in `custom_fields` (scoped per event kind); values go in `client_events.custom` jsonb keyed by field id. Why: the team evolves forms without code changes.

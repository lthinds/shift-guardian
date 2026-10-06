# AGENTS
- All client activity (arm, disarm, trigger, maintenance, observation) lives in one `client_events` table keyed by `kind`; bypasses are a separate table because they have a start/end lifespan. Why: plantão and weekly report read the same rows, so shift entries feed the report automatically.
- Data access uses the browser Lovable Cloud client with RLS (team-wide access for authenticated operators); admin-only actions go through security-definer RPCs. Why: internal team tool, no public data.
- Pure formatting/report logic (week ranges, WhatsApp message, CSV) lives in `src/lib/safenet.ts` with tests. Why: keeps rules testable.

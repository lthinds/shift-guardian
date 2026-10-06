# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Safenet: archives and access

- New operator registrations are pending until an administrator authorizes them in **Operadores**. Existing accounts were preserved as approved during migration.
- Removing an operator blocks access through database policies immediately, then soft-deletes the sign-in account via the authenticated administration function. The historical profile remains.
- Administrators select a local or accessible network folder in **Relatório semanal → Escolher pasta**. Chrome/Edge requires HTTPS (or localhost) and explicit browser permission. Selection lasts for the current browser session; other browsers use download/save dialogs.
- **Salvar e arquivar mês** saves a complete JSON snapshot for all clients in the month. CSV and PDF are separate human-readable exports. Without a browser-confirmed write, the administrator must confirm the downloaded JSON exists before archiving.
- Retention is one calendar month from the saved archive confirmation, not from the date of the event. A daily 03:00 UTC cleanup may delete eligible records up to 24 hours later. Local files are never deleted by the application; legacy archives without `archived_at` remain protected. Restore and save them again to opt into retention.
- Concurrently changed records do not enter the archive; editing an archived event/bypass returns it to the unarchived state. Active bypasses never expire.

### Intranet deployment prerequisites

GitHub sync exports code, not operational data or a working intranet installation. Company IT must separately migrate data, set up the local database/authentication service, apply the SQL migrations, configure browser/server environment variables and backups, and replace the hosted Google authentication broker or use company-approved email authentication.

Run `supabase/archive-cleanup-schedule.sql` on the intranet database with pg_cron installed to enable the same daily cleanup. Configure a database timezone of UTC to match the expiry calculation. The first local administrator must be provisioned by IT in `operator_access` (approved) and `user_roles` (admin) after creating the account; registration no longer automatically grants administrator rights.

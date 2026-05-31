# BP Maintenance Tracker

Stage 1 maintenance workflow MVP for Cloudflare Workers, D1, and R2.

## Local setup

1. Apply the local D1 migration:

```sh
npm run db:migrate:local
```

2. Start the Worker:

```sh
npm run dev
```

3. Open the local Wrangler URL.

## Deploy setup

Create the Cloudflare resources:

```sh
wrangler d1 create bp-maintenance-db
wrangler r2 bucket create bp-maintenance-files
```

Put the returned D1 `database_id` into `wrangler.toml`, then run:

```sh
npm run db:migrate:remote
npm run deploy
```

## Included Stage 1 scope

- Property list and creation
- Supplier list and creation
- Maintenance issue dashboard
- Issue creation and detail page
- Status, urgency, supplier, next action, and due date tracking
- Notes timeline
- Quote, invoice, photo, and document attachment upload to R2
- Dashboard filters for urgent, overdue, owner, supplier, invoice, and closed work

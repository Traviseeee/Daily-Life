# Web Push Setup

Web Push is for signed-in users who install MYLIFE to their Home Screen. On iPhone, use iOS/iPadOS 16.4 or later and open the installed app before enabling alerts.

## Vercel Environment

Create an Upstash Redis database from the Vercel Marketplace, then add these values in Vercel Project Settings > Environment Variables:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose this key in the page)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY` (server only)
- `VAPID_SUBJECT` (for example `mailto:admin@example.com`)
- `SEND_SECRET`
- `CRON_SECRET`

Generate one VAPID key pair and use the matching public and private keys:

```sh
npx web-push generate-vapid-keys
```

Use a long random value for `SEND_SECRET` and `CRON_SECRET`. Redeploy after setting the environment variables. `.env.example` lists the required names without containing credentials.

## Enable on iPhone

1. Deploy the site over HTTPS.
2. In Safari, add MYLIFE to the Home Screen and open it from that icon.
3. Sign in to the MYLIFE account whose reminders should be delivered.
4. Open Daily Life and tap **Enable alerts**, then allow notifications.

The client requests permission from that tap, fetches the public VAPID key from `/api/push-config`, subscribes the service worker, and saves the subscription against the signed-in Supabase user. Private keys remain on the server.

## Delivery and Test

Vercel calls `/api/dispatch` every five minutes. It reads each user's reminders and calendar events from `app_data`, checks their saved device time zone, and sends due items only to that user's subscriptions. The dispatcher deduplicates each device/reminder pair and removes subscriptions that return 404 or 410.

To send a manual test to one account, obtain its Supabase user ID and call:

```sh
curl -X POST https://YOUR_APP.vercel.app/api/send \
  -H "x-secret: YOUR_SEND_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId":"SUPABASE_USER_UUID","title":"Test alert","body":"Web Push is working"}'
```

The `/api/send` route is protected by `SEND_SECRET`; do not put that secret in client code. Vercel Cron availability and minimum schedule frequency depend on the Vercel plan. The configured five-minute schedule requires a plan that permits it.
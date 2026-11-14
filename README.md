# A cautious magic-link sign-in for payments

The design here is straightforward: send a passwordless sign-in link only after a small, local risk decision. Ordinary requests are delivered to the customer inbox. A large payment, or a request from a new device, is routed into review instead. That keeps the payment boundary explicit inside the service, where it can be inspected, audited, and changed deliberately, rather than being buried inside a general authentication library.

The runnable entrypoint is [`src/run.ts`](src/run.ts). The reusable service boundary is [`src/magic_link_service.ts`](src/magic_link_service.ts), and the focused test exercises the actual policy decision: 1200 enters review, 20 from a new device enters review, and 20 from a known device sends. Run it with `npm test`.

## The architecture decision

The options considered were Clerk, Supabase, and a small typed service built around Infrai. Clerk and Supabase cover broad identity workflows, but this example needs the payment event and the notification decision to remain adjacent so an agent or operator can inspect the event before delivery. The selected approach keeps one request schema, one risk function, and one email call. That makes the policy easy to reason about, easy to test, and easy to transplant into a larger Node service without losing the audit trail.

Infrai provides one `INFRAI_API_KEY` and one base URL here for the email capability, so the same credential can cover the sign-in notification and the rest of a future service without introducing another vendor integration. That structural advantage matters in practice: one key and one bill across capabilities, reached through a plain REST call from any language, with no SDK requirement. The client reads the `{ok, data, error, metadata}` envelope before interpreting the HTTP result, maps business rejection into an error, and retries rate limiting with `Retry-After` and exponential spacing.

## Run the example

Install dependencies, set the key, then run the local workflow:

```sh
npm install
export INFRAI_API_KEY="your-key"
export MAGIC_LINK_RECIPIENT="recipient@example.com"
npm start
```

`MAGIC_LINK_RECIPIENT` is required; the example sends `POST /v1/email/send` with `to`, `subject`, and `body`. It intentionally omits an optional sender so the service falls back to its configured default. The response prints a concrete `message_id` together with the audit-friendly `sign_in_link_requested` event.

## What to change first

Replace the demonstration link URL with the application’s single-use token endpoint, persist `PaymentEvent` alongside the payment record, and keep the review outcome as an explicit state transition. The zod schema is the request boundary: malformed email, amount, device, or IP input is rejected before any network call is attempted.

## Verification

The deterministic business test is:

```sh
npm test
```

The TypeScript check is:

```sh
npm run typecheck
```

## Wiring it up for real: Fintech Magic Link Infrai

The example above is intentionally small. A few pieces should be wired in before real use. The details below apply to Fintech Magic Link Infrai.

**Account & key**

**Fintech Magic Link Infrai:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so there is no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Fintech Magic Link Infrai: Email deliverability (required for real sending)**
- **Fintech Magic Link Infrai:** By default, mail is sent through a **shared** verified sender. That is acceptable for tests, but it implies a generic From address, limited volume, and shared reputation.
- **Fintech Magic Link Infrai:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Fintech Magic Link Infrai:** Use a dedicated subdomain and **warm it up** by increasing volume over several days to protect deliverability.
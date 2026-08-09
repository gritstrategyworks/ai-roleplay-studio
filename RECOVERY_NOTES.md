# Production recovery snapshot

This branch was reconstructed from the production Worker on 2026-08-09 (Asia/Tokyo).

- Production Worker: `ai-roleplay-studio`
- Production URL: `https://ai-roleplay-studio.ai-roleplay-studio.workers.dev/`
- Recovered Worker version: `e6d726cf-f802-44cc-9221-bb646026d0c9`
- Version created: `2026-08-07T03:03:46.469Z`
- Worker entry point: `src/index.js`
- Static assets used by Wrangler: `public/`
- D1 binding: `BILLING_DB` / `ai-roleplay-billing`
- Other bindings: `AI`, `ASSETS`

The top-level static files are retained for manual GitHub upload compatibility. The same production files are under `public/` for Workers Static Assets deployment.

## Secrets

The production secrets `AUTH_PEPPER`, `BILLING_SESSION_SECRET`, and `STRIPE_WEBHOOK_SECRET` remain in Cloudflare and are intentionally not present in this repository. Do not replace or commit them. Deploy with `--keep-vars`.

## Verification

```powershell
npm install
npm run check
npm run deploy:dry
```

The D1 export is stored outside the repository in the local work directory because it may contain private application data. Do not upload it to GitHub.

## Publishing policy

Work locally on `sync/public-current-20260809`. Review the diff, then upload or push only after explicit approval. Do not edit the GitHub repository or production Worker directly from an unreviewed working tree.

# Temporary deployment

**Status: not deployed.** Hosting needs an account choice and possibly public access, which
needs your approval. Nothing was published and no credentials were used. The build is ready.

## Build artifact

```bash
pnpm install
pnpm build
```

Output: `dist/dq-remediation-prototype/browser`. This folder is the whole app: static files
only, hash routing (no server rewrite rules), relative base path, synthetic data only, no
secrets or private URLs.

## Hosting options (static)

| Option | Fit | Notes |
|--------|-----|-------|
| Company-internal static hosting (for example S3 plus CloudFront, or an internal web server, behind company SSO) | Best if available: not public, no new cost surprise | The registry host in the developer's npm config suggests AWS is in use; confirm which account is appropriate. |
| GitHub Pages | Free, quick | Public unless the org plan allows private Pages. Needs a repo, which this project does not have yet. |
| Azure Static Web Apps (free tier) | Free tier, can add auth | Needs an Azure subscription. |
| Netlify or Vercel | Free tiers, one-command deploy | Public URL by default. Password protection may be a paid feature. |

Recommendation: an **internal, SSO-protected** host if the project owner has one, since the
workshop content references internal ticket numbers. If nothing is available, a free public
host is acceptable because all data is synthetic, but the ticket IDs in the UI would then be
public, so confirm that is fine first.

## Please decide

1. Which provider and account?
2. Public or restricted access?
3. Expiry date for removal?

## Redeploy (example, any static host)

```bash
pnpm build
# upload the contents of dist/dq-remediation-prototype/browser to the host
```

## Remove

Delete the uploaded files or the hosting site or project. Nothing else holds data, because
the app stores only a role and a flag in each visitor's own browser.

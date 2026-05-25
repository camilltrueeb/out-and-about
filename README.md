# Out and About

Hugo-based site with a wishlist ("Wohin"), blog posts, and an interactive map. Hosted on Netlify with Decap CMS for content editing.

---

## Local development

```bash
npm run dev   # starts Hugo (port 1313) + Netlify dev proxy (port 8888) + decap-server (port 8081)
```

Open `localhost:8888` for the site, `localhost:8888/admin` for the CMS.

---

## Authentication

The entire site is protected by a Netlify Edge Function (`netlify/edge-functions/auth-gate.js`) that runs before every request.

**Stack:** [Netlify Identity](https://docs.netlify.com/security/secure-access-to-sites/identity/) (GoTrue) for user management + login UI, edge function for gating.

**How it works:**

1. **Edge function (gatekeeper):** Reads the `auth_token` cookie and calls `https://mehuse.xyz/.netlify/identity/user` with it as a Bearer token. GoTrue returns 200 if valid, 401 if expired or invalid. Static assets, `/login`, and `/.netlify/*` paths pass through without a check. Unauthenticated requests get a `302 → /login?redirect=<path>` with `Cache-Control: no-store`.

2. **Login page (`/login.html`):** Uses the [netlify-identity-widget](https://github.com/netlify/netlify-identity-widget) (loaded from CDN). On `init`, if a stored session exists the widget silently refreshes the token and the page redirects immediately. On `login`, the JWT access token is stored in the `auth_token` cookie with `max-age` matching the token's `exp` claim.

3. **Footer (every page):** The widget's `init`, `login`, and `token` events keep `auth_token` fresh as GoTrue renews tokens in the background. The logout button clears the cookie and redirects to `/login`. Access tokens expire after ~1 hour; refresh tokens after ~7 days.

**GoTrue / Netlify Identity setup:**

- Enable Identity in the Netlify dashboard → **Identity** tab
- Invite users via the dashboard (signup is disabled)
- No installation: the widget is loaded from `https://identity.netlify.com/v1/netlify-identity-widget.js`
- The GoTrue API is served automatically at `https://<your-site>/.netlify/identity`
- Local dev: the widget shows a one-time dialog asking for the site URL (`https://mehuse.xyz`); this is stored in `localStorage` for subsequent runs

---

## External services

### Netlify

**Role:** Hosting, CI/CD, serverless functions, CMS authentication.

| What | Where |
|---|---|
| Site | out-and-about.netlify.app (alias: mehuse.xyz) |
| Functions | `netlify/functions/` — currently: `visit` (visit counter) |
| CMS auth | Git Gateway — grants CMS write access via Netlify Identity |

**Monitor:**
- Build minutes (free tier: 500 min/month)
- Bandwidth (free tier: 100 GB/month)
- Function invocations (free tier: 125k/month)
- Netlify Identity seats (free tier: 1,000 active users)

**Updates:** Netlify auto-deploys from `main` branch. CMS uses `staging` branch as its write target (configured in `static/admin/config.yml`).

---

### Cloudinary

**Role:** Image storage and CDN for all wohin gallery images and post cover images.

| What | Value |
|---|---|
| Cloud name | `dx2yckdac` |
| API key | `191346469648154` (public — safe in config) |
| API secret | Never committed — rotate immediately if exposed |
| Upload preset | `outandabout_admin` (unsigned — safe in frontend code) |

The upload preset allows CMS admins to upload images without a Cloudinary account login. It is unsigned, meaning anyone with the preset name can upload to your account — do not publish it beyond the CMS.

**Monitor:**
- Storage (free tier: 25 GB)
- Transformations (free tier: 25 credits/month)
- Bandwidth (free tier: 25 GB/month)

Dashboard: cloudinary.com → Media Library / Usage

**Updates:** CDN URLs are permanent once uploaded. Deleting an asset in Cloudinary does not remove it from the site — the reference in the content file must also be removed via the CMS.

---

### Decap CMS

**Role:** Browser-based content editor at `/admin`.

Loaded from unpkg CDN at the versions pinned in `static/admin/index.html`:

```
decap-cms@^3.0.0
decap-cms-media-library-cloudinary@^3.0.0
```

**Custom widgets** (in `static/admin/`):
- `route-widget.js` — draws a GPX route on a Leaflet/Swisstopo map and stores it as GeoJSON
- `gallery-widget.js` — multi-image picker via Cloudinary Upload Widget, stores `{urls, thumb}` as JSON in the `gallery` frontmatter field

**Monitor:**
- Decap CMS releases: github.com/decaporg/decap-cms — check for breaking changes before bumping the version in `index.html`

---

### OpenRouteService

**Role:** Calculates driving distance from Zürich to the start point of each wohin route. Called client-side; results are cached in `localStorage` so the API is only hit once per unique route start coordinate.

| What | Value |
|---|---|
| Endpoint | `api.openrouteservice.org/v2/directions/driving-car` |
| API key | Stored in `layouts/wohin/list.html` — visible in page source |

The API key is a basic key (free tier). Restrict it to `mehuse.xyz` and `out-and-about.netlify.app` as allowed HTTP referrers in the ORS dashboard to prevent misuse.

**Monitor:**
- Requests (free tier: 2,000/day)

Dashboard: openrouteservice.org → Dashboard → API Key usage

---

### Swisstopo WMTS (map tiles)

**Role:** Map tile layers shown in the interactive route map modal and in the CMS route-drawing widget.

Loaded from `wmts.geo.admin.ch` — no API key required, free for non-commercial use.

**Monitor:** Terms of use at swisstopo.admin.ch. If tiles stop loading, check the WMTS capabilities endpoint for layer ID changes.

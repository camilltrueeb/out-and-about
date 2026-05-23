# Out and About

Hugo-based site with a wishlist ("Wohin"), blog posts, and an interactive map. Hosted on Netlify with Decap CMS for content editing.

---

## Local development

```bash
npm run dev   # starts Hugo (port 1313) + Netlify dev proxy (port 8888) + decap-server (port 8081)
```

Open `localhost:8888` for the site, `localhost:8888/admin` for the CMS.

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

### Swisstopo WMTS (map tiles)

**Role:** Map tile layers shown in the interactive route map modal and in the CMS route-drawing widget.

Loaded from `wmts.geo.admin.ch` — no API key required, free for non-commercial use.

**Monitor:** Terms of use at swisstopo.admin.ch. If tiles stop loading, check the WMTS capabilities endpoint for layer ID changes.

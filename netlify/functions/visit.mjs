import { getStore } from '@netlify/blobs';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  const url = new URL(req.url);
  const raw = url.searchParams.get('slug');
  if (!raw) return json({ error: 'Missing slug' }, 400);
  const slug = raw.trim();

  try {
    const store = getStore('wishlist-visits');

    if (req.method === 'POST') {
      const delta = url.searchParams.get('delta') === '-1' ? -1 : 1;
      const raw = await store.get(slug);
      const current = parseInt(raw ?? '0');
      const next = Math.max(0, current + delta);
      await store.set(slug, String(next));
      return json({ count: next });
    }

    const raw = await store.get(slug);
    return json({ count: parseInt(raw ?? '0') });
  } catch (err) {
    console.error('[visit]', err);
    return json({ error: err.message }, 500);
  }
};


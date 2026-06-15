export default async (req) => {
  // Require a valid Netlify Identity session (nf_jwt cookie)
  const cookies = req.headers.get('cookie') || '';
  const hasJwt  = /(?:^|;\s*)nf_jwt=/.test(cookies);
  if (!hasJwt && !process.env.NETLIFY_DEV) {
    return new Response('Unauthorized', { status: 401 });
  }

  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!secret) return new Response('Not configured', { status: 404 });

  const cloud = 'dx2yckdac';
  const key   = '191346469648154';
  const auth  = Buffer.from(`${key}:${secret}`).toString('base64');

  const assets = [];
  let cursor = null;
  do {
    const url = `https://api.cloudinary.com/v1_1/${cloud}/resources/image?max_results=500`
              + (cursor ? `&next_cursor=${cursor}` : '');
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) return new Response('Cloudinary error', { status: 502 });
    const data = await res.json();
    assets.push(...data.resources.map(r => r.secure_url));
    cursor = data.next_cursor || null;
  } while (cursor);

  return new Response(JSON.stringify(assets), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=60' },
  });
};

const IDENTITY_URL = 'https://mehuse.xyz/.netlify/identity';

export default async (request, context) => {
  const url = new URL(request.url);
  const { pathname } = url;

  // Pass through: CMS, Netlify internals, login page, static assets
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/.netlify') ||
    pathname === '/login' ||
    pathname === '/login.html' ||
    /\.[a-z0-9]{1,10}$/i.test(pathname)
  ) {
    return context.next();
  }

  // Skip auth gate in local dev — nf_jwt is only set by Netlify's CDN
  if (Netlify.env.get('NETLIFY_DEV')) {
    return context.next();
  }

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)nf_jwt=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;

  if (token && await validateToken(token)) {
    return context.next();
  }

  const redirectTo = encodeURIComponent(pathname + url.search);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `${url.origin}/login?redirect=${redirectTo}`,
      'Cache-Control': 'no-store',
    },
  });
};

async function validateToken(token) {
  let resp;
  try {
    resp = await fetch(`${IDENTITY_URL}/user`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch (e) {
    console.error('[auth-gate] identity fetch threw:', e.message);
    return false;
  }
  if (!resp.ok && resp.status !== 401) {
    console.error('[auth-gate] identity returned unexpected status:', resp.status);
  }
  return resp.ok;
}

export const config = { path: '/*' };

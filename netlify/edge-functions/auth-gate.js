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

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)auth_token=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;

  if (token && await validateToken(token)) {
    return context.next();
  }

  console.log('[auth-gate] redirecting to login', { pathname, reason: token ? 'invalid token' : 'no cookie' });
  return loginRedirect(url, pathname);
};

function loginRedirect(url, pathname) {
  const redirectTo = encodeURIComponent(pathname + url.search);
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `${url.origin}/login?redirect=${redirectTo}`,
      'Cache-Control': 'no-store',
      'Set-Cookie': 'auth_token=; Path=/; Max-Age=0; SameSite=Strict',
    },
  });
}

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

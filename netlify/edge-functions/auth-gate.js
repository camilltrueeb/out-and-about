export default async (request, context) => {
  const url = new URL(request.url);
  const { pathname } = url;

  // Pass through: CMS admin, Netlify internals, login page, and any static asset
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
  const match = cookieHeader.match(/(?:^|;\s*)nf_jwt=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;

  if (token && isTokenValid(token)) {
    return context.next();
  }

  const redirectTo = encodeURIComponent(pathname + url.search);
  return Response.redirect(`${url.origin}/login?redirect=${redirectTo}`, 302);
};

function isTokenValid(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return false;
    if (!payload.sub) return false;
    return true;
  } catch {
    return false;
  }
}

export const config = { path: '/*' };

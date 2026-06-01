export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let token, maxAge;
  try {
    const body = await req.json();
    token = body.token;
    maxAge = parseInt(body.maxAge) || 3600;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Basic JWT structure check: three base64url segments separated by dots
  if (
    !token ||
    typeof token !== 'string' ||
    !/^[A-Za-z0-9_=+-]+\.[A-Za-z0-9_=+-]+\.[A-Za-z0-9_=+-]+$/.test(token)
  ) {
    return new Response('Invalid token', { status: 400 });
  }

  if (maxAge < 1 || maxAge > 86400 * 7) maxAge = 3600;

  return new Response(null, {
    status: 204,
    headers: {
      'Set-Cookie': `nf_jwt=${token}; Path=/; SameSite=Lax; Secure; Max-Age=${maxAge}`,
      'Cache-Control': 'no-store',
    },
  });
};

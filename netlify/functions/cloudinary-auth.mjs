import { createHash } from 'crypto';

export default async () => {
  const secret   = process.env.CLOUDINARY_API_SECRET;
  const username = process.env.CLOUDINARY_USERNAME;

  if (!secret || !username) {
    return new Response('Not configured', { status: 404 });
  }

  const cloudName = 'dx2yckdac';
  const timestamp = Math.round(Date.now() / 1000);
  const signature = createHash('sha256')
    .update(`cloud_name=${cloudName}&timestamp=${timestamp}&username=${username}${secret}`)
    .digest('hex');

  return new Response(
    JSON.stringify({ cloud_name: cloudName, username, timestamp, signature }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  );
};

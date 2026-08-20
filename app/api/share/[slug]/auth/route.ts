import { NextRequest, NextResponse } from 'next/server';
import { getShareLinkBySlug, verifySharePassword } from '@/lib/share';
import { signShareSession } from '@/lib/share-token';

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: 'Thiếu mật khẩu' }, { status: 400 });

  const link = await getShareLinkBySlug(slug);
  if (!link || link.revokedAt) {
    return NextResponse.json({ error: 'Link không tồn tại hoặc đã bị thu hồi' }, { status: 404 });
  }

  const ok = await verifySharePassword(link.projectId, password);
  if (!ok) return NextResponse.json({ error: 'Sai mật khẩu' }, { status: 401 });

  const { token, maxAgeSeconds } = signShareSession(slug);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(`share_session_${slug}`, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSeconds,
    path: '/',
  });
  return res;
}
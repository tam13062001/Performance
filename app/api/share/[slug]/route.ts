import { NextRequest, NextResponse } from 'next/server';
import { getShareLinkBySlug } from '@/lib/share';
import { verifyShareSession } from '@/lib/share-token';

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const link = await getShareLinkBySlug(slug);
  if (!link || link.revokedAt) {
    return NextResponse.json({ error: 'Link không tồn tại hoặc đã bị thu hồi' }, { status: 404 });
  }

  const cookie = req.cookies.get(`share_session_${slug}`)?.value;
  const authed = verifyShareSession(cookie, slug);

  return NextResponse.json({
    authed,
    projectCode: link.projectCode,
    projectLabel: link.projectLabel,
    allowedPages: link.allowedPages,
    label: link.label,
  });
}
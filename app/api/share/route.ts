import { NextRequest, NextResponse } from 'next/server';
import { createShareLink, listShareLinks, revokeShareLink } from '@/lib/share';

export async function GET(req: NextRequest) {
  const projectCode = req.nextUrl.searchParams.get('projectCode');
  if (!projectCode) return NextResponse.json({ error: 'Thiếu projectCode' }, { status: 400 });

  try {
    const links = await listShareLinks(projectCode);
    return NextResponse.json({ links });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectCode, allowedPages, label, password } = body ?? {};

  if (!projectCode || !Array.isArray(allowedPages) || allowedPages.length === 0) {
    return NextResponse.json({ error: 'Thiếu projectCode hoặc allowedPages' }, { status: 400 });
  }

  try {
    const link = await createShareLink({ projectCode, allowedPages, label, password });
    return NextResponse.json({ link });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) return NextResponse.json({ error: 'Thiếu slug' }, { status: 400 });
  await revokeShareLink(slug);
  return NextResponse.json({ ok: true });
}
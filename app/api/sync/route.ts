import { NextRequest, NextResponse } from 'next/server';
import { syncAllForProject } from '@/lib/syncAll';

export const maxDuration = 60;

async function runSync(projectCode: string | undefined) {
  const mmuId = process.env.GOOGLE_SHEET_MMU_ID;
  const tanakanId = process.env.GOOGLE_SHEET_TANAKAN_ID;

  const results = [];

  if ((!projectCode || projectCode === 'MMU') && mmuId) {
    results.push(...(await syncAllForProject('MMU', mmuId)));
  }
  if ((!projectCode || projectCode === 'TANAKAN') && tanakanId) {
    results.push(...(await syncAllForProject('TANAKAN', tanakanId)));
  }

  return results;
}

// GET /api/sync?project_code=TANAKAN - test nhanh bằng cách mở link trên trình duyệt
export async function GET(request: NextRequest) {
  const projectCode = request.nextUrl.searchParams.get('project_code') ?? undefined;
  const results = await runSync(projectCode);
  const hasError = results.some((r) => r.errorMessage);

  return NextResponse.json(
    { synced_at: new Date().toISOString(), results },
    { status: hasError ? 500 : 200 }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const projectCode = body.project_code as string | undefined;
  const results = await runSync(projectCode);
  const hasError = results.some((r) => r.errorMessage);

  return NextResponse.json(
    { synced_at: new Date().toISOString(), results },
    { status: hasError ? 500 : 200 }
  );
}
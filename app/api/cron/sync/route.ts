import { NextRequest, NextResponse } from 'next/server';
import { syncAllForProject } from '@/lib/syncAll';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mmuId = process.env.GOOGLE_SHEET_MMU_ID;
  const tanakanId = process.env.GOOGLE_SHEET_TANAKAN_ID;

  const results = [];

  if (mmuId) results.push(...(await syncAllForProject('MMU', mmuId)));
  if (tanakanId) results.push(...(await syncAllForProject('TANAKAN', tanakanId)));

  const hasError = results.some((r) => r.errorMessage);

  return NextResponse.json(
    { synced_at: new Date().toISOString(), results },
    { status: hasError ? 500 : 200 }
  );
}
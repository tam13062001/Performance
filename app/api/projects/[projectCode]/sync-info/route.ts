import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectCode: string }> }
) {
  const { projectCode } = await params;

  const res = await pool.query(
    `SELECT last_synced_at FROM ad_projects WHERE project_code = $1`,
    [projectCode]
  );

  if (res.rows.length === 0) {
    return NextResponse.json({ error: 'Không tìm thấy project' }, { status: 404 });
  }

  return NextResponse.json({ lastSyncedAt: res.rows[0].last_synced_at });
}
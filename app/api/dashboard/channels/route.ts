import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-static';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectCode = searchParams.get('project_code'); // 'MMU' | 'TANAKAN' | null = tất cả

  try {
    const query = projectCode
      ? `SELECT * FROM vw_ad_dashboard_channel_summary WHERE project_code = $1 ORDER BY spend DESC`
      : `SELECT * FROM vw_ad_dashboard_channel_summary ORDER BY project_code, spend DESC`;

    const params = projectCode ? [projectCode] : [];
    const result = await pool.query(query, params);

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching channel summary:', error);
    return NextResponse.json(
      { error: 'Không lấy được dữ liệu channel summary' },
      { status: 500 }
    );
  }
}
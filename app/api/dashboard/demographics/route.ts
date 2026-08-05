import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectCode = searchParams.get('project_code');
  const dimensionType = searchParams.get('dimension_type'); // 'age' | 'gender' | 'region'

  if (!dimensionType || !['age', 'gender', 'region'].includes(dimensionType)) {
    return NextResponse.json(
      { error: "dimension_type phải là 'age', 'gender' hoặc 'region'" },
      { status: 400 }
    );
  }

  try {
    const conditions = ['dimension_type = $1'];
    const params: (string)[] = [dimensionType];

    if (projectCode) {
      params.push(projectCode);
      conditions.push(`project_code = $${params.length}`);
    }

    const query = `
      SELECT
        project_code,
        channel_name,
        dimension_value,
        SUM(impressions) AS impressions,
        SUM(reach) AS reach,
        SUM(clicks) AS clicks,
        SUM(spend) AS spend
      FROM vw_ad_demographic_dashboard
      WHERE ${conditions.join(' AND ')}
      GROUP BY project_code, channel_name, dimension_value
      ORDER BY channel_name, impressions DESC
    `;

    const result = await pool.query(query, params);
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching demographics:', error);
    return NextResponse.json(
      { error: 'Không lấy được dữ liệu demographic breakdown' },
      { status: 500 }
    );
  }
}
// app/api/projects/sheets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/projects/sheets?project_code=TANAKAN
// Trả về danh sách tên tab (sheet) thật trong Google Sheet đã kết nối cho project này.
export async function GET(request: NextRequest) {
  const projectCode = request.nextUrl.searchParams.get('project_code');
  if (!projectCode) {
    return NextResponse.json({ error: 'Thiếu project_code' }, { status: 400 });
  }
  const upperCode = projectCode.trim().toUpperCase();

  const { data: project, error: findError } = await supabase
    .from('sync_projects')
    .select('sheet_id')
    .eq('project_code', upperCode)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!project) {
    return NextResponse.json({ error: `Không tìm thấy project "${upperCode}".` }, { status: 404 });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.get({ spreadsheetId: project.sheet_id });

    const tabs = (res.data.sheets ?? []).map((s) => ({
      title: s.properties?.title ?? '',
      sheetId: s.properties?.sheetId,
      rowCount: s.properties?.gridProperties?.rowCount ?? null,
    }));

    return NextResponse.json({ tabs });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Không lấy được danh sách sheet. Kiểm tra quyền truy cập.', detail: e.message },
      { status: 500 }
    );
  }
}
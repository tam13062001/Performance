// app/api/projects/sheets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const projectCode = request.nextUrl.searchParams.get('project_code');
  if (!projectCode) {
    return NextResponse.json({ error: 'Thiếu project_code' }, { status: 400 });
  }
  const upperCode = projectCode.trim().toUpperCase();

  // 1. Chạy 2 truy vấn Supabase song song
  const [
    { data: syncProjects, error: syncError },
    { data: adSources, error: adError }
  ] = await Promise.all([
    // Query 1: Lấy sheet_id từ sync_projects
    supabase
      .from('sync_projects')
      .select('sheet_id, label')
      .eq('project_code', upperCode),
    
    // Query 2: Lấy sheet_id từ ad_project_sheet_sources (thông qua ad_projects)
    supabase
      .from('ad_project_sheet_sources')
      .select(`
        sheet_id,
        source_type,
        ad_projects!inner(project_code)
      `)
      .eq('ad_projects.project_code', upperCode)
  ]);

  if (syncError || adError) {
    return NextResponse.json(
      { error: 'Lỗi truy vấn Database', details: syncError?.message || adError?.message },
      { status: 500 }
    );
  }

  // 2. Gộp danh sách các sheet_id tìm được từ 2 bảng
  const allSheetsToFetch: Array<{ id: string, type: string, name: string }> = [];

  // Thêm dữ liệu từ sync_projects
  if (syncProjects && syncProjects.length > 0) {
    syncProjects.forEach((item) => {
      if (item.sheet_id) {
        allSheetsToFetch.push({
          id: item.sheet_id,
          type: 'sync_project', // Phân loại để frontend dễ nhận biết
          name: item.label || 'Sync Output',
        });
      }
    });
  }

  // Thêm dữ liệu từ ad_project_sheet_sources
  if (adSources && adSources.length > 0) {
    adSources.forEach((item) => {
      if (item.sheet_id) {
        allSheetsToFetch.push({
          id: item.sheet_id,
          type: 'ad_source', // Phân loại nguồn quảng cáo
          name: item.source_type || 'Ad Source',
        });
      }
    });
  }

  // Nếu không có sheet nào ở cả 2 bảng
  if (allSheetsToFetch.length === 0) {
    return NextResponse.json({ 
      error: `Không tìm thấy sheet nào cho project "${upperCode}" ở cả 2 bảng.` 
    }, { status: 404 });
  }

  // 3. Khởi tạo Google Sheets API
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
          ?.replace(/\\n/g, '\n')
          ?.replace(/"/g, ''),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheetsAPI = google.sheets({ version: 'v4', auth });

    // 4. Lấy danh sách tabs của tất cả các sheet đồng thời
    const fetchPromises = allSheetsToFetch.map(async (sheetDef) => {
      try {
        const res = await sheetsAPI.spreadsheets.get({ spreadsheetId: sheetDef.id });
        
        const tabs = (res.data.sheets ?? []).map((s) => ({
          title: s.properties?.title ?? '',
          sheetId: s.properties?.sheetId,
          rowCount: s.properties?.gridProperties?.rowCount ?? null,
        }));

        return {
          sourceType: sheetDef.type,
          sourceName: sheetDef.name,
          spreadsheetId: sheetDef.id,
          tabs
        };
      } catch (sheetError: any) {
        // Bắt lỗi từng sheet (ví dụ: Service account chưa được share quyền vào 1 sheet cụ thể)
        return {
          sourceType: sheetDef.type,
          sourceName: sheetDef.name,
          spreadsheetId: sheetDef.id,
          error: sheetError.message
        };
      }
    });

    const results = await Promise.all(fetchPromises);

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Không khởi tạo được Google API. Kiểm tra thông tin Auth.', detail: e.message },
      { status: 500 }
    );
  }
}
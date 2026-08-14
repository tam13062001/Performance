// app/api/projects/sheet-sources/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractSheetId, buildSheetUrl } from '@/lib/sheet-url';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { project_code, source_type, url } = body as {
    project_code?: string;
    source_type?: 'demographic_sem' | 'demographic_facebook';
    url?: string;
  };

  if (!project_code || !source_type || !url) {
    return NextResponse.json({ error: 'Thiếu project_code, source_type hoặc url' }, { status: 400 });
  }

  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return NextResponse.json({ error: 'Không parse được sheet ID.' }, { status: 400 });
  }

  const { data: project } = await supabase
    .from('ad_projects')
    .select('id')
    .eq('project_code', project_code.toUpperCase())
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: `Không tìm thấy project "${project_code}".` }, { status: 404 });
  }

  // Verify quyền truy cập
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Không truy cập được sheet này. Kiểm tra quyền share Viewer.', detail: e.message },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('ad_project_sheet_sources')
    .upsert(
      { project_id: project.id, source_type, sheet_id: sheetId, sheet_url: buildSheetUrl(sheetId) },
      { onConflict: 'project_id,source_type' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data }, { status: 201 });
}

export async function GET(request: NextRequest) {
  const projectCode = request.nextUrl.searchParams.get('project_code');
  if (!projectCode) return NextResponse.json({ error: 'Thiếu project_code' }, { status: 400 });

  const { data: project } = await supabase
    .from('ad_projects')
    .select('id')
    .eq('project_code', projectCode.toUpperCase())
    .maybeSingle();
  if (!project) return NextResponse.json({ error: `Không tìm thấy project.` }, { status: 404 });

  const { data, error } = await supabase
    .from('ad_project_sheet_sources')
    .select('*')
    .eq('project_id', project.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data });
}
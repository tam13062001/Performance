// app/api/projects/sync-source/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { extractSheetId, buildSheetUrl } from '@/lib/sheet-url';
import { createSyncProject, listActiveSyncProjects } from '@/lib/sync-projects';
import { google } from 'googleapis'; // đã dùng sẵn trong syncAll, tận dụng lại credentials


export async function GET() {
  const projects = await listActiveSyncProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { url, project_code, label } = body as {
    url?: string;
    project_code?: string;
    label?: string;
  };

  if (!url || !project_code || !label) {
    return NextResponse.json(
      { error: 'Thiếu url, project_code hoặc label' },
      { status: 400 }
    );
  }

  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return NextResponse.json(
      { error: 'Không parse được sheet ID từ URL. Kiểm tra lại link Google Sheet.' },
      { status: 400 }
    );
  }

  // Verify: thử đọc metadata sheet để chắc chắn service account có quyền truy cập
  // (dùng lại credentials/service account đã cấu hình cho sync engine)
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
      {
        error:
          'Không truy cập được sheet này. Kiểm tra: (1) sheet ID đúng chưa, (2) đã share sheet cho service account email chưa.',
        detail: e.message,
      },
      { status: 400 }
    );
  }

  const upperCode = project_code.trim().toUpperCase();
  try {
    const project = await createSyncProject({
      project_code: upperCode,
      label: label.trim(),
      sheet_id: sheetId,
      sheet_url: buildSheetUrl(sheetId),
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e: any) {
    // project_code trùng -> unique constraint lỗi
    return NextResponse.json(
      { error: `Không thêm được project (có thể project_code "${upperCode}" đã tồn tại).`, detail: e.message },
      { status: 409 }
    );
  }
}
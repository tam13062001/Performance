// app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractSheetId, buildSheetUrl } from '@/lib/sheet-url';
import { google } from 'googleapis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ---------- GET /api/projects — danh sách project active ----------
export async function GET() {
  const { data: syncData, error: syncErr } = await supabase
    .from('sync_projects')
    .select('project_code, label, sheet_id, sheet_url')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (syncErr) return NextResponse.json({ error: syncErr.message }, { status: 500 });

  const codes = (syncData ?? []).map((s) => s.project_code);
  const { data: adData, error: adErr } =
    codes.length > 0
      ? await supabase
          .from('ad_projects')
          .select('project_code, client, description, start_date, end_date, status, billing_model')
          .in('project_code', codes)
      : { data: [], error: null };

  if (adErr) return NextResponse.json({ error: adErr.message }, { status: 500 });

  const adByCode = new Map((adData ?? []).map((a) => [a.project_code, a]));

  const projects = (syncData ?? []).map((s) => {
    const ad = adByCode.get(s.project_code);
    return {
      code: s.project_code,
      label: s.label,
      sheetId: s.sheet_id,
      client: ad?.client ?? "",
      description: ad?.description ?? "",
      startDate: ad?.start_date ?? "",
      endDate: ad?.end_date ?? "",
      status: ad?.status ?? "Active",
      billingModel: ad?.billing_model ?? "transparent",
    };
  });

  return NextResponse.json({ projects });
}

// ---------- POST /api/projects — tạo project mới (ghi ad_projects + sync_projects) ----------
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const {
    url,
    project_code,
    label,
    client,
    description,
    start_date,
    end_date,
    status,
    billing_model,
    has_region,
  } = body as {
    url?: string;
    project_code?: string;
    label?: string;
    client?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    billing_model?: string;
    has_region?: boolean;
  };

  if (!url || !project_code || !label) {
    return NextResponse.json({ error: 'Thiếu url, project_code hoặc label' }, { status: 400 });
  }

  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return NextResponse.json(
      { error: 'Không parse được sheet ID từ URL. Kiểm tra lại link Google Sheet.' },
      { status: 400 }
    );
  }

  // Verify quyền truy cập sheet trước khi ghi DB
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
        error: 'Không truy cập được sheet này. Kiểm tra: (1) sheet ID đúng chưa, (2) đã share sheet cho service account email chưa.',
        detail: e.message,
      },
      { status: 400 }
    );
  }

  const upperCode = project_code.trim().toUpperCase();

  const [{ data: existingAd }, { data: existingSync }] = await Promise.all([
    supabase.from('ad_projects').select('id').eq('project_code', upperCode).maybeSingle(),
    supabase.from('sync_projects').select('id').eq('project_code', upperCode).maybeSingle(),
  ]);
  if (existingAd || existingSync) {
    return NextResponse.json(
      { error: `project_code "${upperCode}" đã tồn tại.` },
      { status: 409 }
    );
  }

  const { data: adProject, error: adError } = await supabase
    .from('ad_projects')
    .insert({
      project_code: upperCode,
      display_name: label.trim(),
      has_region: has_region ?? true,
      client: client?.trim() || null,
      description: description?.trim() || null,
      start_date: start_date || null,
      end_date: end_date || null,
      status: status || 'Active',
      billing_model: billing_model || 'transparent',
    })
    .select()
    .single();

  if (adError) {
    return NextResponse.json(
      { error: 'Không tạo được project trong ad_projects.', detail: adError.message },
      { status: 500 }
    );
  }

  const { data: syncProject, error: syncError } = await supabase
    .from('sync_projects')
    .insert({
      project_code: upperCode,
      label: label.trim(),
      sheet_id: sheetId,
      sheet_url: buildSheetUrl(sheetId),
    })
    .select()
    .single();

  if (syncError) {
    // rollback thủ công vì Supabase JS client không hỗ trợ transaction giữa 2 bảng
    await supabase.from('ad_projects').delete().eq('project_code', upperCode);
    const isRLS = syncError.message?.includes('row-level security');
    return NextResponse.json(
      {
        error: isRLS
          ? 'Server thiếu quyền ghi vào sync_projects (RLS). Kiểm tra SUPABASE_SERVICE_ROLE_KEY.'
          : 'Không tạo được project trong sync_projects, đã rollback ad_projects.',
        detail: syncError.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      project: {
        code: upperCode,
        label: label.trim(),
        sheetId,
        client: adProject.client,
        description: adProject.description,
        startDate: adProject.start_date,
        endDate: adProject.end_date,
        status: adProject.status,
        billingModel: adProject.billing_model,
      },
    },
    { status: 201 }
  );
}

// ---------- PATCH /api/projects?project_code=XXX — sửa metadata project ----------
// KHÔNG đổi project_code hay sheet đã kết nối qua route này (đổi sheet cần
// endpoint riêng vì phải re-verify quyền truy cập Google Sheet).
export async function PATCH(request: NextRequest) {
  const projectCode = request.nextUrl.searchParams.get('project_code');
  if (!projectCode) {
    return NextResponse.json({ error: 'Thiếu project_code' }, { status: 400 });
  }
  const upperCode = projectCode.trim().toUpperCase();

  const body = await request.json().catch(() => ({}));
  const {
    label,
    client,
    description,
    start_date,
    end_date,
    status,
    billing_model,
  } = body as {
    label?: string;
    client?: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    billing_model?: string;
  };

  const { data: existing, error: findError } = await supabase
    .from('ad_projects')
    .select('id')
    .eq('project_code', upperCode)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (!existing) {
    return NextResponse.json({ error: `Không tìm thấy project "${upperCode}".` }, { status: 404 });
  }

  const adPatch: Record<string, any> = {};
  if (label !== undefined) adPatch.display_name = label.trim();
  if (client !== undefined) adPatch.client = client.trim() || null;
  if (description !== undefined) adPatch.description = description.trim() || null;
  if (start_date !== undefined) adPatch.start_date = start_date || null;
  if (end_date !== undefined) adPatch.end_date = end_date || null;
  if (status !== undefined) adPatch.status = status;
  if (billing_model !== undefined) adPatch.billing_model = billing_model;

  const { data: adProject, error: adError } = await supabase
    .from('ad_projects')
    .update(adPatch)
    .eq('project_code', upperCode)
    .select()
    .single();

  if (adError) {
    return NextResponse.json(
      { error: 'Không cập nhật được ad_projects.', detail: adError.message },
      { status: 500 }
    );
  }

  // label hiển thị cũng lưu song song ở sync_projects — cập nhật đồng bộ để không lệch tên
  if (label !== undefined) {
    const { error: syncError } = await supabase
      .from('sync_projects')
      .update({ label: label.trim() })
      .eq('project_code', upperCode);
    if (syncError) {
      return NextResponse.json(
        { error: 'Đã cập nhật ad_projects nhưng lỗi khi đồng bộ label sang sync_projects.', detail: syncError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    project: {
      code: upperCode,
      label: adProject.display_name,
      client: adProject.client,
      description: adProject.description,
      startDate: adProject.start_date,
      endDate: adProject.end_date,
      status: adProject.status,
      billingModel: adProject.billing_model,
    },
  });
}

// ---------- DELETE /api/projects?project_code=XXX[&force=true] ----------
// Mặc định chỉ xóa nếu project chưa có data (an toàn). Truyền &force=true
// để xóa kèm toàn bộ data liên quan trong các bảng ad_*.
const AD_DATA_TABLES = [
  'ad_raw_data',
  'ad_delivery_status',
  'ad_unit_cost_plan',
  'ad_raw_report',
  'ad_raw_facebook_data',
  'ad_raw_tiktok_data',
  'ad_raw_sem_data',
  'ad_raw_youtube_data',
  'ad_raw_adx_data',
  'ad_raw_gdn_data',
  'ad_raw_linkedin_data',
  'ad_raw_mb_inpage_data',
  'ad_raw_zalo_data',
  'ad_report',
  'ad_report_data',
  'ad_campaigns',
  'ad_channels',
  'ad_content_items',
  'ad_content_daily_metrics',
  'ad_daily_metrics',
  'ad_demographic_metrics',
  'ad_facebook_detail_output',
  'ad_platform_accounts',
  'ad_sheet_date_selection',
  'ad_import_batches',
  'ad_sync_jobs',
] as const;

export async function DELETE(request: NextRequest) {
  const projectCode = request.nextUrl.searchParams.get('project_code');
  const force = request.nextUrl.searchParams.get('force') === 'true';

  if (!projectCode) {
    return NextResponse.json({ error: 'Thiếu project_code' }, { status: 400 });
  }

  const upperCode = projectCode.trim().toUpperCase();

  const { data: adProject, error: findError } = await supabase
    .from('ad_projects')
    .select('id, project_code')
    .eq('project_code', upperCode)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }
  if (!adProject) {
    return NextResponse.json({ error: `Không tìm thấy project "${upperCode}".` }, { status: 404 });
  }

  const counts: { table: string; count: number }[] = [];
  for (const table of AD_DATA_TABLES) {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('project_id', adProject.id);
    if (!error && count) counts.push({ table, count });
  }

  const totalRows = counts.reduce((s, c) => s + c.count, 0);
  if (totalRows > 0 && !force) {
    return NextResponse.json(
      {
        error: `Project "${upperCode}" còn ${totalRows} dòng dữ liệu ở ${counts.length} bảng. Thêm &force=true vào request để xóa kèm toàn bộ data.`,
        detail: counts,
      },
      { status: 409 }
    );
  }

  if (force && totalRows > 0) {
    for (const { table } of counts) {
      const { error } = await supabase.from(table).delete().eq('project_id', adProject.id);
      if (error) {
        return NextResponse.json(
          { error: `Xóa data thất bại ở bảng ${table}, dừng lại để tránh xóa dở dang.`, detail: error.message },
          { status: 500 }
        );
      }
    }
  }

  const { error: syncDeleteError } = await supabase
    .from('sync_projects')
    .delete()
    .eq('project_code', upperCode);
  if (syncDeleteError) {
    return NextResponse.json(
      { error: 'Xóa sync_projects thất bại.', detail: syncDeleteError.message },
      { status: 500 }
    );
  }

  const { error: adDeleteError } = await supabase
    .from('ad_projects')
    .delete()
    .eq('project_code', upperCode);
  if (adDeleteError) {
    return NextResponse.json(
      { error: 'Xóa ad_projects thất bại (sync_projects đã xóa, dữ liệu có thể lệch).', detail: adDeleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: upperCode, deletedRows: totalRows });
}
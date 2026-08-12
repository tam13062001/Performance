// app/api/projects/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const [{ data: adProjects, error: e1 }, { data: syncProjects, error: e2 }] = await Promise.all([
    supabase.from('ad_projects').select('id, project_code, display_name, has_region'),
    supabase.from('sync_projects').select('project_code, label, sheet_id, sheet_url').eq('is_active', true),
  ]);

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const syncByCode = new Map((syncProjects ?? []).map((s) => [s.project_code, s]));

  // Chỉ trả project có mặt ở CẢ HAI bảng — nếu chỉ có ở sync_projects mà chưa
  // có ở ad_projects, sync sẽ lỗi khi ghi data nên loại ra khỏi danh sách hiển thị
  const projects = (adProjects ?? [])
    .filter((p) => syncByCode.has(p.project_code))
    .map((p) => {
      const sync = syncByCode.get(p.project_code)!;
      return {
        code: p.project_code,
        label: p.display_name,
        sheetId: sync.sheet_id,
        hasRegion: p.has_region,
      };
    });

  // Cảnh báo dev: project có sheet nhưng chưa được tạo trong ad_projects
  const orphaned = (syncProjects ?? []).filter((s) => !adProjects?.some((p) => p.project_code === s.project_code));
  if (orphaned.length > 0) {
    console.warn(
      '[GET /api/projects] Các project sau có trong sync_projects nhưng chưa có trong ad_projects, sẽ không sync được:',
      orphaned.map((s) => s.project_code)
    );
  }

  return NextResponse.json({ projects });
}
import { NextRequest, NextResponse } from 'next/server';
import { syncAllForProject } from '@/lib/syncAll';
import { listActiveSyncProjects, getSyncProjectByCode } from '@/lib/sync-projects';

export const maxDuration = 60;

async function runSync(projectCode: string | undefined, table: string | undefined) {
  const results = [];

  if (projectCode) {
    // Sync đúng 1 project theo code
    const project = await getSyncProjectByCode(projectCode);
    if (!project) {
      return [{ project_code: projectCode, errorMessage: `Không tìm thấy project "${projectCode}" trong sync_projects.` }];
    }
    results.push(...(await syncAllForProject(project.project_code, project.sheet_id, table)));
    return results;
  }

  // Sync toàn bộ project đang active — không còn giới hạn 2 project cứng nữa
  const projects = await listActiveSyncProjects();
  for (const p of projects) {
    results.push(...(await syncAllForProject(p.project_code, p.sheet_id, table)));
  }

  return results;
}

export async function GET(request: NextRequest) {
  const projectCode = request.nextUrl.searchParams.get('project_code') ?? undefined;
  const table = request.nextUrl.searchParams.get('table') ?? undefined;
  const results = await runSync(projectCode, table);
  const hasError = results.some((r) => r.errorMessage);

  return NextResponse.json(
    { synced_at: new Date().toISOString(), results },
    { status: hasError ? 500 : 200 }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const projectCode = body.project_code as string | undefined;
  const table = body.table as string | undefined;
  const results = await runSync(projectCode, table);
  const hasError = results.some((r) => r.errorMessage);

  return NextResponse.json(
    { synced_at: new Date().toISOString(), results },
    { status: hasError ? 500 : 200 }
  );
}
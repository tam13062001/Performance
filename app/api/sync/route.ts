import { NextRequest, NextResponse } from 'next/server';
import { syncAllForProject } from '@/lib/syncAll';
import { listActiveSyncProjects, getSyncProjectByCode } from '@/lib/sync-projects';

export const maxDuration = 60;

// Thêm biến tab vào runSync
async function runSync(projectCode: string | undefined, table: string | undefined, testMode: boolean, tab: string | undefined) {
  const results = [];

  if (projectCode) {
    const project = await getSyncProjectByCode(projectCode);
    if (!project) {
      return [{ project_code: projectCode, errorMessage: `Không tìm thấy project "${projectCode}"` }];
    }
    results.push(...(await syncAllForProject(project.project_code, project.sheet_id, table, testMode, tab)));
    return results;
  }

  const projects = await listActiveSyncProjects();
  for (const p of projects) {
    results.push(...(await syncAllForProject(p.project_code, p.sheet_id, table, testMode, tab)));
  }

  return results;
}

export async function GET(request: NextRequest) {
  const projectCode = request.nextUrl.searchParams.get('project_code') ?? undefined;
  const table = request.nextUrl.searchParams.get('table') ?? undefined;
  const tab = request.nextUrl.searchParams.get('tab') ?? undefined; 
  
  // Mặc định test = false nếu không truyền param test=true
  const isTest = request.nextUrl.searchParams.get('test') == 'true';

  const results = await runSync(projectCode, table, isTest, tab);
  const hasError = results.some((r) => r.errorMessage);

  return NextResponse.json(
    { 
      synced_at: new Date().toISOString(), 
      is_test_mode: isTest,
      filter: { projectCode, table, tab }, 
      results 
    },
    { status: hasError ? 500 : 200 }
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const projectCode = body.project_code as string | undefined;
  const table = body.table as string | undefined;
  const tab = body.tab as string | undefined; 
  
  // Mặc định test = true
  const isTest = body.test !== false;

  const results = await runSync(projectCode, table, isTest, tab);
  const hasError = results.some((r) => r.errorMessage);

  return NextResponse.json(
    { 
      synced_at: new Date().toISOString(), 
      is_test_mode: isTest,
      filter: { projectCode, table, tab },
      results 
    },
    { status: hasError ? 500 : 200 }
  );
}
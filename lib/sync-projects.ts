// lib/sync-projects.ts
import { createClient } from '@supabase/supabase-js'; // chỉnh theo client bạn đang dùng

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // dùng service role vì route chạy server-side
);

export type SyncProject = {
  id: string;
  project_code: string;
  label: string;
  sheet_id: string;
  sheet_url: string;
  is_active: boolean;
};

export async function listActiveSyncProjects(): Promise<SyncProject[]> {
  const { data, error } = await supabase
    .from('sync_projects')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`listActiveSyncProjects: ${error.message}`);
  return data ?? [];
}

export async function getSyncProjectByCode(projectCode: string): Promise<SyncProject | null> {
  const { data, error } = await supabase
    .from('sync_projects')
    .select('*')
    .eq('project_code', projectCode)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(`getSyncProjectByCode: ${error.message}`);
  return data;
}

export async function createSyncProject(input: {
  project_code: string;
  label: string;
  sheet_id: string;
  sheet_url: string;
}): Promise<SyncProject> {
  const { data, error } = await supabase
    .from('sync_projects')
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`createSyncProject: ${error.message}`);
  return data;
}
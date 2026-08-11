// Client-side fetcher gọi thẳng route /api/data đã có sẵn (không đổi route đó).
// Dùng ở "use client" component — KHÔNG gọi Supabase trực tiếp ở client vì
// route /api/data đã cầm service role key và lo việc đó rồi.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? ""; // để trống nếu cùng origin, tránh hardcode localhost:3000

export interface ApiDataResponse<T> {
  table: string;
  project_code_input: string;
  project_uuid_used: string;
  total_rows: number;
  data: T[];
}

const cache = new Map<string, Promise<any[]>>();

/**
 * Fetch toàn bộ rows của 1 table cho 1 project (limit=all), có cache trong
 * phiên trình duyệt (key = table::projectCode) để đổi tab/filter không phải
 * gọi lại API nếu cùng project.
 */
export async function fetchTable<T = any>(table: string, projectCode: string, opts?: { noCache?: boolean }): Promise<T[]> {
  const key = `${table}::${projectCode}`;
  if (!opts?.noCache && cache.has(key)) {
    return cache.get(key)! as Promise<T[]>;
  }

  const promise = (async () => {
    const url = `${API_BASE}/api/data?table=${encodeURIComponent(table)}&project_code=${encodeURIComponent(projectCode)}&limit=all`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Lỗi fetch ${table} (${projectCode}): HTTP ${res.status}`);
    }
    const json: ApiDataResponse<T> = await res.json();
    if ((json as any).error) {
      throw new Error(`Lỗi fetch ${table} (${projectCode}): ${(json as any).error}`);
    }
    return json.data ?? [];
  })();

  cache.set(key, promise);
  // Nếu lỗi thì xoá cache để lần sau thử lại thay vì cache luôn cả lỗi.
  promise.catch(() => cache.delete(key));
  return promise;
}

export function clearTableCache(table?: string, projectCode?: string) {
  if (!table) {
    cache.clear();
    return;
  }
  if (!projectCode) {
    for (const key of cache.keys()) {
      if (key.startsWith(`${table}::`)) cache.delete(key);
    }
    return;
  }
  cache.delete(`${table}::${projectCode}`);
}
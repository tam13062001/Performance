import { pool } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { randomBytes } from 'crypto';

export type ShareLink = {
  id: number;
  projectId: number;
  projectCode: string;
  projectLabel: string;
  slug: string;
  label: string | null;
  allowedPages: string[];
  createdAt: string;
  revokedAt: string | null;
};

function generateSlug(): string {
  return randomBytes(9).toString('base64url'); // ~12 ký tự, đủ khó đoán cho URL public
}

export async function createShareLink(params: {
  projectCode: string;
  allowedPages: string[];
  label?: string;
  password?: string; // có giá trị -> set/đổi password của project; để trống -> giữ nguyên password cũ
}): Promise<ShareLink> {
  const client = await pool.connect();
  try {
    const projectRes = await client.query(
      `SELECT id, project_code, display_name FROM ad_projects WHERE project_code = $1`,
      [params.projectCode]
    );
    if (projectRes.rows.length === 0) throw new Error(`Không tìm thấy project "${params.projectCode}"`);
    const project = projectRes.rows[0];

    if (params.password) {
      await client.query(`UPDATE ad_projects SET share_password_hash = $1 WHERE id = $2`, [
        hashPassword(params.password),
        project.id,
      ]);
    } else {
      const check = await client.query(`SELECT share_password_hash FROM ad_projects WHERE id = $1`, [project.id]);
      if (!check.rows[0]?.share_password_hash) {
        throw new Error('Project này chưa có password — bắt buộc nhập password cho lần tạo link đầu tiên.');
      }
    }

    const slug = generateSlug();
    const insertRes = await client.query(
      `INSERT INTO ad_share_links (project_id, slug, label, allowed_pages)
       VALUES ($1, $2, $3, $4)
       RETURNING id, slug, label, allowed_pages, created_at, revoked_at`,
      [project.id, slug, params.label ?? null, params.allowedPages]
    );
    const row = insertRes.rows[0];

    return {
      id: row.id,
      projectId: project.id,
      projectCode: project.project_code,
      projectLabel: project.display_name,
      slug: row.slug,
      label: row.label,
      allowedPages: row.allowed_pages,
      createdAt: row.created_at,
      revokedAt: row.revoked_at,
    };
  } finally {
    client.release();
  }
}

export async function listShareLinks(projectCode: string): Promise<ShareLink[]> {
  const res = await pool.query(
    `SELECT sl.id, sl.project_id, p.project_code, p.display_name AS project_label, sl.slug, sl.label,
            sl.allowed_pages, sl.created_at, sl.revoked_at
     FROM ad_share_links sl
     JOIN ad_projects p ON p.id = sl.project_id
     WHERE p.project_code = $1
     ORDER BY sl.created_at DESC`,
    [projectCode]
  );
  return res.rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    projectCode: r.project_code,
    projectLabel: r.project_label,
    slug: r.slug,
    label: r.label,
    allowedPages: r.allowed_pages,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  }));
}

export async function revokeShareLink(slug: string): Promise<void> {
  await pool.query(`UPDATE ad_share_links SET revoked_at = now() WHERE slug = $1 AND revoked_at IS NULL`, [slug]);
}

export async function getShareLinkBySlug(slug: string): Promise<ShareLink | null> {
  const res = await pool.query(
    `SELECT sl.id, sl.project_id, p.project_code, p.display_name AS project_label, sl.slug, sl.label,
            sl.allowed_pages, sl.created_at, sl.revoked_at
     FROM ad_share_links sl
     JOIN ad_projects p ON p.id = sl.project_id
     WHERE sl.slug = $1`,
    [slug]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id,
    projectId: r.project_id,
    projectCode: r.project_code,
    projectLabel: r.project_label,
    slug: r.slug,
    label: r.label,
    allowedPages: r.allowed_pages,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  };
}

export async function verifySharePassword(projectId: number, password: string): Promise<boolean> {
  const res = await pool.query(`SELECT share_password_hash FROM ad_projects WHERE id = $1`, [projectId]);
  if (res.rows.length === 0) return false;
  return verifyPassword(password, res.rows[0].share_password_hash);
}
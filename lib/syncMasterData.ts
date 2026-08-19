import { pool } from './db';
import { getSheetValues } from './googleSheets';
import { resolveChannelId, resolveCampaignId, parseSheetNumber, parseSheetDate } from './syncHelpers';

interface MasterDataColumnMap {
  phase: number;
  channel: number;
  reportDate: number;
  campaignName: number;
  buyingType: number;
  startDate: number;
  endDate: number;
  reach: number;
  impressions: number;
  engagements: number;
  views: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  leads: number;
  spend: number;
  region: number | null;
  asset: number | null;
}

// ⚠️ COLUMN_MAPS chỉ áp dụng cho các project CÒN dùng sheet MASTER_DATA kiểu cũ
// (gộp sẵn mọi dimension trong 1 tab). Từ khi chuyển sang layout chuẩn
// MTD_DATA/MTD_DELIVERY_STATUS/MTD_REPORT/MTD_UNIT_COST_PLAN (xem syncConfigs.ts),
// project MỚI KHÔNG CẦN khai báo ở đây nữa — pipeline này sẽ tự skip nếu
// project không có entry, thay vì báo lỗi.
const COLUMN_MAPS: Record<string, MasterDataColumnMap> = {
  TANAKAN: {
    region: 1, phase: 2, channel: 3, asset: 4, reportDate: 5, campaignName: 6,
    buyingType: 7, startDate: 8, endDate: 9, reach: 10, impressions: 11,
    engagements: 12, views: 13, clicks: 14, linkClicks: 15, landingPageViews: 16,
    leads: 17, spend: 18,
  },
  MMU: {
    region: null, asset: null, phase: 1, channel: 2, reportDate: 3, campaignName: 4,
    buyingType: 5, startDate: 6, endDate: 7, reach: 8, impressions: 9,
    engagements: 10, views: 11, clicks: 12, linkClicks: 13, landingPageViews: 14,
    leads: 15, spend: 16,
  },
};

export interface SyncResult {
  projectCode: string;
  table?: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  errorMessage?: string;
  sampleErrors?: string[];
  mergedDuplicateGroups?: number; // số nhóm dòng bị trùng key đã được cộng dồn lại
  skippedEmpty?: boolean;
}

// Một dòng đã gộp: giữ nguyên phần dimension, cộng dồn phần metric.
interface AggregatedRow {
  channelName: string;
  campaignName: string;
  reportDate: string;
  phase: string;
  buyingType: string | null;
  startDate: string | null;
  endDate: string | null;
  region: string | null;
  asset: string | null;
  reach: number;
  impressions: number;
  engagements: number;
  views: number;
  clicks: number;
  linkClicks: number;
  landingPageViews: number;
  leads: number;
  spend: number;
  rowsMerged: number;
}

export async function syncMasterDataForProject(
  projectCode: string,
  spreadsheetId: string,
  tabName: string = 'MASTER_DATA'
): Promise<SyncResult> {
  const client = await pool.connect();
  let batchId: number | null = null;

  const COL = COLUMN_MAPS[projectCode];
  if (!COL) {
    // ⬅️ Đổi từ "lỗi" sang "skip" — project mới theo layout chuẩn MTD_DATA
    // không cần sheet MASTER_DATA, nên không có mapping ở đây là bình thường,
    // không phải cấu hình thiếu sót.
    client.release();
    return {
      projectCode,
      table: 'ad_daily_metrics',
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      skippedEmpty: true,
    };
  }

  try {
    const projectRes = await client.query(`SELECT id FROM ad_projects WHERE project_code = $1`, [projectCode]);
    if (projectRes.rows.length === 0) throw new Error(`Không tìm thấy project_code "${projectCode}" trong ad_projects`);
    const projectId = projectRes.rows[0].id;

    // ⬅️ Nếu tab MASTER_DATA không tồn tại trong sheet (project chưa từng dùng
    // layout cũ), coi là skip thay vì lỗi — getSheetValues sẽ throw nếu tab
    // không tồn tại, nên bắt riêng lỗi đó ở đây.
    let rawRows: unknown[][];
    try {
      rawRows = await getSheetValues(spreadsheetId, tabName);
    } catch (fetchErr) {
      const msg = (fetchErr as Error).message ?? '';
      if (/unable to parse range|not found/i.test(msg)) {
        return { projectCode, table: 'ad_daily_metrics', totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
      }
      throw fetchErr;
    }

    const batchRes = await client.query(
      `INSERT INTO ad_import_batches (project_id, source_file_name, source_sheet_name, status)
       VALUES ($1, $2, $3, 'processing') RETURNING id`,
      [projectId, spreadsheetId, tabName]
    );
    batchId = batchRes.rows[0].id;

    const dataRows = rawRows.slice(1).filter((row) => row.length > 0 && row[COL.campaignName]);

    if (dataRows.length === 0) {
      await client.query(`UPDATE ad_import_batches SET status = 'success', total_rows = 0, success_rows = 0, failed_rows = 0 WHERE id = $1`, [batchId]);
      return { projectCode, table: 'ad_daily_metrics', totalRows: 0, successRows: 0, failedRows: 0, skippedEmpty: true };
    }

    let failedRows = 0;
    const sampleErrors: string[] = [];

    // ---------- BƯỚC 1: gộp (SUM) các dòng trùng conflict key ----------
    // Key giống hệt key trong ON CONFLICT bên dưới. Dòng nào share key thì
    // cộng dồn metric lại thành 1 dòng duy nhất, KHÔNG để DB tự bỏ dòng thừa.
    const grouped = new Map<string, AggregatedRow>();
    for (const row of dataRows) {
      const channelName = String(row[COL.channel] ?? '').trim();
      const campaignName = String(row[COL.campaignName] ?? '').trim();
      const reportDate = parseSheetDate(row[COL.reportDate]);

      if (!channelName || !campaignName || !reportDate) {
        failedRows++;
        if (sampleErrors.length < 5) {
          sampleErrors.push(`Thiếu dữ liệu bắt buộc (channel="${channelName}", campaign="${campaignName}", date="${row[COL.reportDate]}")`);
        }
        continue;
      }

      const phase = String(row[COL.phase] ?? 'other').trim().toLowerCase();
      const buyingType = row[COL.buyingType] ? String(row[COL.buyingType]).trim() : null;
      const startDate = parseSheetDate(row[COL.startDate]);
      const endDate = parseSheetDate(row[COL.endDate]);
      const region = COL.region !== null && row[COL.region] ? String(row[COL.region]).trim() : null;
      const asset = COL.asset !== null && row[COL.asset] ? String(row[COL.asset]).trim() : null;

      // PHẢI khớp đúng với conflictColumns của câu INSERT bên dưới
      const key = [channelName.toLowerCase(), campaignName, reportDate, buyingType ?? '', asset ?? ''].join('::');

      const existing = grouped.get(key);
      const reach = parseSheetNumber(row[COL.reach]);
      const impressions = parseSheetNumber(row[COL.impressions]);
      const engagements = parseSheetNumber(row[COL.engagements]);
      const views = parseSheetNumber(row[COL.views]);
      const clicks = parseSheetNumber(row[COL.clicks]);
      const linkClicks = parseSheetNumber(row[COL.linkClicks]);
      const landingPageViews = parseSheetNumber(row[COL.landingPageViews]);
      const leads = parseSheetNumber(row[COL.leads]);
      const spend = parseSheetNumber(row[COL.spend]);

      if (existing) {
        existing.reach += reach;
        existing.impressions += impressions;
        existing.engagements += engagements;
        existing.views += views;
        existing.clicks += clicks;
        existing.linkClicks += linkClicks;
        existing.landingPageViews += landingPageViews;
        existing.leads += leads;
        existing.spend += spend;
        existing.rowsMerged += 1;
      } else {
        grouped.set(key, {
          channelName, campaignName, reportDate,
          phase: ['awareness', 'consideration', 'conversion'].includes(phase) ? phase : 'other',
          buyingType, startDate, endDate, region, asset,
          reach, impressions, engagements, views, clicks, linkClicks, landingPageViews, leads, spend,
          rowsMerged: 1,
        });
      }
    }

    const mergedDuplicateGroups = [...grouped.values()].filter((g) => g.rowsMerged > 1).length;
    if (mergedDuplicateGroups > 0) {
      console.warn(
        `[syncMasterData] ${projectCode}: ${mergedDuplicateGroups} nhóm dòng bị trùng conflict key đã được cộng dồn ` +
        `(tổng ${[...grouped.values()].reduce((s, g) => s + g.rowsMerged - 1, 0)} dòng thừa). ` +
        `Kiểm tra sheet MASTER_DATA xem có chiều dữ liệu nào (audience/placement...) đang bị rollup mất không.`
      );
    }

    // ---------- BƯỚC 2: upsert từng dòng đã gộp, DO UPDATE để idempotent ----------
    let successRows = 0;
    const channelIdCache = new Map<string, number>();
    const campaignIdCache = new Map<string, number>();

    await client.query('BEGIN');

    for (const g of grouped.values()) {
      await client.query('SAVEPOINT row_sp');
      try {
        const channelId = channelIdCache.get(g.channelName.toLowerCase())
          ?? await resolveChannelId(client, g.channelName);
        channelIdCache.set(g.channelName.toLowerCase(), channelId);

        const campaignCacheKey = `${channelId}::${g.campaignName}`;
        const campaignId = campaignIdCache.get(campaignCacheKey)
          ?? await resolveCampaignId(client, {
            projectId, channelId, campaignName: g.campaignName,
            phase: g.phase, buyingType: g.buyingType, startDate: g.startDate, endDate: g.endDate,
          });
        campaignIdCache.set(campaignCacheKey, campaignId);

        await client.query(
          `INSERT INTO ad_daily_metrics (
            project_id, campaign_id, channel_id, import_batch_id,
            project_code, phase, channel, report_date, campaign_name, buying_type,
            start_date, end_date, region, asset,
            reach, impressions, engagements, views, clicks, link_clicks,
            landing_page_views, leads, spend
          ) VALUES (
            $1,$2,$3,$4, $5,$6,$7,$8,$9,$10, $11,$12,$13,$14,
            $15,$16,$17,$18,$19,$20,$21,$22,$23
          )
          ON CONFLICT (project_id, channel_id, campaign_name, report_date, COALESCE(buying_type, ''), COALESCE(asset, ''))
          DO UPDATE SET
            campaign_id = EXCLUDED.campaign_id,
            import_batch_id = EXCLUDED.import_batch_id,
            phase = EXCLUDED.phase,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            region = EXCLUDED.region,
            asset = EXCLUDED.asset,
            reach = EXCLUDED.reach,
            impressions = EXCLUDED.impressions,
            engagements = EXCLUDED.engagements,
            views = EXCLUDED.views,
            clicks = EXCLUDED.clicks,
            link_clicks = EXCLUDED.link_clicks,
            landing_page_views = EXCLUDED.landing_page_views,
            leads = EXCLUDED.leads,
            spend = EXCLUDED.spend`,
          [
            projectId, campaignId, channelId, batchId,
            projectCode, g.phase, g.channelName, g.reportDate, g.campaignName, g.buyingType,
            g.startDate, g.endDate, g.region, g.asset,
            g.reach, g.impressions, g.engagements, g.views, g.clicks, g.linkClicks,
            g.landingPageViews, g.leads, g.spend,
          ]
        );
        await client.query('RELEASE SAVEPOINT row_sp');
        successRows++;
      } catch (rowErr) {
        await client.query('ROLLBACK TO SAVEPOINT row_sp');
        const msg = (rowErr as Error).message;
        console.error(`Lỗi ở row (project=${projectCode}, table=ad_daily_metrics):`, msg);
        if (sampleErrors.length < 5) sampleErrors.push(msg);
        failedRows++;
      }
    }

    await client.query('COMMIT');
    await client.query(
      `UPDATE ad_import_batches SET status = 'success', total_rows = $1, success_rows = $2, failed_rows = $3 WHERE id = $4`,
      [dataRows.length, successRows, failedRows, batchId]
    );

    return {
      projectCode, table: 'ad_daily_metrics',
      totalRows: dataRows.length, successRows, failedRows, sampleErrors,
      mergedDuplicateGroups,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    const message = (err as Error).message;
    if (batchId) {
      await client.query(`UPDATE ad_import_batches SET status = 'failed', error_message = $1 WHERE id = $2`, [message, batchId]).catch(() => {});
    }
    return { projectCode, table: 'ad_daily_metrics', totalRows: 0, successRows: 0, failedRows: 0, errorMessage: message };
  } finally {
    client.release();
  }
}
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
    return {
      projectCode,
      table: 'ad_daily_metrics',
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      errorMessage: `Chưa có column mapping cho project "${projectCode}" trong COLUMN_MAPS.`,
    };
  }

  try {
    const projectRes = await client.query(`SELECT id FROM ad_projects WHERE project_code = $1`, [projectCode]);
    if (projectRes.rows.length === 0) throw new Error(`Không tìm thấy project_code "${projectCode}" trong ad_projects`);
    const projectId = projectRes.rows[0].id;

    const batchRes = await client.query(
      `INSERT INTO ad_import_batches (project_id, source_file_name, source_sheet_name, status)
       VALUES ($1, $2, $3, 'processing') RETURNING id`,
      [projectId, spreadsheetId, tabName]
    );
    batchId = batchRes.rows[0].id;

    const rawRows = await getSheetValues(spreadsheetId, tabName);
    const dataRows = rawRows.slice(1).filter((row) => row.length > 0 && row[COL.campaignName]);

    let successRows = 0;
    let failedRows = 0;
    const sampleErrors: string[] = [];

    const channelIdCache = new Map<string, number>();
    const campaignIdCache = new Map<string, number>();

    await client.query('BEGIN');
    // Không xóa data cũ - dùng ON CONFLICT DO NOTHING: dòng mới thì thêm,
    // dòng trùng key (project+channel+campaign+ngày+buying_type+asset) thì tự bỏ qua.

    for (const row of dataRows) {
      await client.query('SAVEPOINT row_sp');
      try {
        const channelName = String(row[COL.channel] ?? '').trim();
        const campaignName = String(row[COL.campaignName] ?? '').trim();
        const reportDate = parseSheetDate(row[COL.reportDate]);

        if (!channelName || !campaignName || !reportDate) {
          await client.query('ROLLBACK TO SAVEPOINT row_sp');
          failedRows++;
          if (sampleErrors.length < 5) {
            sampleErrors.push(`Thiếu dữ liệu bắt buộc (channel="${channelName}", campaign="${campaignName}", date="${row[COL.reportDate]}")`);
          }
          continue;
        }

        const channelId = channelIdCache.get(channelName.toLowerCase())
          ?? await resolveChannelId(client, channelName);
        channelIdCache.set(channelName.toLowerCase(), channelId);

        const phase = String(row[COL.phase] ?? 'other').trim().toLowerCase();
        const buyingType = row[COL.buyingType] ? String(row[COL.buyingType]).trim() : null;
        const startDate = parseSheetDate(row[COL.startDate]);
        const endDate = parseSheetDate(row[COL.endDate]);

        const campaignCacheKey = `${channelId}::${campaignName}`;
        const campaignId = campaignIdCache.get(campaignCacheKey)
          ?? await resolveCampaignId(client, {
            projectId, channelId, campaignName,
            phase: ['awareness', 'consideration', 'conversion'].includes(phase) ? phase : 'other',
            buyingType, startDate, endDate,
          });
        campaignIdCache.set(campaignCacheKey, campaignId);

        const region = COL.region !== null && row[COL.region] ? String(row[COL.region]).trim() : null;
        const asset = COL.asset !== null && row[COL.asset] ? String(row[COL.asset]).trim() : null;

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
          DO NOTHING`,
          [
            projectId, campaignId, channelId, batchId,
            projectCode,
            ['awareness', 'consideration', 'conversion'].includes(phase) ? phase : 'other',
            channelName, reportDate, campaignName, buyingType,
            startDate, endDate, region, asset,
            parseSheetNumber(row[COL.reach]),
            parseSheetNumber(row[COL.impressions]),
            parseSheetNumber(row[COL.engagements]),
            parseSheetNumber(row[COL.views]),
            parseSheetNumber(row[COL.clicks]),
            parseSheetNumber(row[COL.linkClicks]),
            parseSheetNumber(row[COL.landingPageViews]),
            parseSheetNumber(row[COL.leads]),
            parseSheetNumber(row[COL.spend]),
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

    return { projectCode, table: 'ad_daily_metrics', totalRows: dataRows.length, successRows, failedRows, sampleErrors };
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
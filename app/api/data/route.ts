import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const table = searchParams.get('table');
  const projectCode = searchParams.get('project_code');
  const limitParam = searchParams.get('limit'); 

  if (!table) {
    return NextResponse.json({ error: "Thiếu tham số 'table' trong URL" }, { status: 400 });
  }

  let targetId = projectCode;

  // TỰ ĐỘNG LẤY UUID TỪ BẢNG ad_projects
  if (projectCode) {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectCode);
    
    if (!isUUID) {
      // ĐÃ SỬA LẠI TÊN CỘT THÀNH 'project_code' DỰA THEO ẢNH CỦA BẠN
      const { data: projectData, error: projectError } = await supabase
        .from('ad_projects')
        .select('id')
        .eq('project_code', projectCode) 
        .single();

      if (projectError || !projectData) {
        return NextResponse.json({ 
          error: `Không tìm thấy dự án nào có mã '${projectCode}' trong bảng ad_projects.`,
          details: projectError?.message
        }, { status: 404 });
      }

      targetId = projectData.id;
    }
  }

  try {
    let allData: any[] = [];
    let queryError = null;

    if (limitParam === 'all') {
      const chunkSize = 1000; 
      let from = 0;
      let to = chunkSize - 1;
      let hasMore = true;

      while (hasMore) {
        let query = supabase.from(table).select('*').range(from, to);
        
        if (targetId) query = query.eq('project_id', targetId);

        const { data, error } = await query;
        
        if (error) { 
          queryError = error; 
          break; 
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          from += chunkSize;
          to += chunkSize;
          
          if (data.length < chunkSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }
    } else {
      const limit = parseInt(limitParam ?? '1000', 10);
      let query = supabase.from(table).select('*').limit(limit);
      
      if (targetId) query = query.eq('project_id', targetId);

      const { data, error } = await query;
      
      if (error) queryError = error;
      else if (data) allData = data;
    }

    if (queryError) {
      throw queryError;
    }

    return NextResponse.json({ 
      table,
      project_code_input: projectCode || 'ALL',
      project_uuid_used: targetId || 'ALL',
      total_rows: allData.length,
      data: allData 
    }, { status: 200 });

  } catch (err: any) {
    console.error("Lỗi API Data:", err);
    return NextResponse.json({ error: "Lỗi Database", details: err.message }, { status: 500 });
  }
}
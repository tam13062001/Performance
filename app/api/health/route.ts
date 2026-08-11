import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-static';

export async function GET() {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    return NextResponse.json({
      status: 'ok',
      db_time: result.rows[0].current_time,
    });
  } catch (error) {
    console.error('DB connection error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Không kết nối được database' },
      { status: 500 }
    );
  }
}
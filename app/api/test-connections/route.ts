import { NextRequest, NextResponse } from 'next/server';
import { checkApiConnections } from '@/lib/api-connections';

export const dynamic = 'force-dynamic';

type Body = {
  leagueKey?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const connections = await checkApiConnections(body?.leagueKey);
    return NextResponse.json({ connections });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron probar las conexiones.' },
      { status: 500 },
    );
  }
}

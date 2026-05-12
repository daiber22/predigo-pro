import { NextResponse } from 'next/server';
import { checkLeagueStatuses } from '@/lib/api-connections';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await checkLeagueStatuses();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo validar el mapa de ligas.' },
      { status: 500 },
    );
  }
}

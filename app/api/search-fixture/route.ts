import { NextRequest, NextResponse } from 'next/server';
import { searchFixtureWithStats } from '@/lib/api-football';
import { TeamSearchInput } from '@/lib/types';

export const dynamic = 'force-dynamic';

function toInput(body: any): TeamSearchInput {
  return {
    homeTeam: String(body?.homeTeam || '').trim(),
    awayTeam: String(body?.awayTeam || '').trim(),
    leagueKey: body?.leagueKey ? String(body.leagueKey).trim() : undefined,
    league: body?.league ? String(body.league).trim() : undefined,
    country: body?.country ? String(body.country).trim() : undefined,
    season: body?.season ? Number(body.season) : undefined,
    matchDate: body?.matchDate ? String(body.matchDate) : undefined,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = toInput(body);

    if (!input.homeTeam || !input.awayTeam) {
      return NextResponse.json({ error: 'Debes indicar equipo local y visitante.' }, { status: 400 });
    }

    const fixture = await searchFixtureWithStats(input);
    return NextResponse.json({ fixture });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo buscar el partido.' },
      { status: 500 },
    );
  }
}

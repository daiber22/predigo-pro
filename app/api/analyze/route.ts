import { NextRequest, NextResponse } from 'next/server';
import { analyzeMatch } from '@/lib/model';
import { FixtureMatch, OddsResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

type AnalyzeBody = {
  fixture?: FixtureMatch;
  odds?: OddsResponse;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalyzeBody;
    const fixture = body?.fixture;

    if (!fixture?.stats) {
      return NextResponse.json({ error: 'No se recibieron estadísticas del partido.' }, { status: 400 });
    }

    const analysis = analyzeMatch(fixture.stats, body.odds);
    analysis.fixtureId = fixture.fixtureId;

    return NextResponse.json({ analysis });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudo calcular el análisis.' },
      { status: 500 },
    );
  }
}

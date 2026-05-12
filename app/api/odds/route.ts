import { NextRequest, NextResponse } from 'next/server';
import { getOddsForFixture } from '@/lib/odds';
import { FixtureMatch, OddsMarketKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

type OddsBody = {
  fixture?: FixtureMatch;
  bookmakerKey?: string;
  comparisonMarkets?: OddsMarketKey[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OddsBody;
    const fixture = body?.fixture;

    if (!fixture?.stats?.homeTeam || !fixture?.stats?.awayTeam) {
      return NextResponse.json({ error: 'No se recibió un fixture válido para buscar cuotas.' }, { status: 400 });
    }

    const odds = await getOddsForFixture(fixture, {
      bookmakerKey: body.bookmakerKey,
      comparisonMarkets: body.comparisonMarkets,
    });

    return NextResponse.json({ odds });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'No se pudieron cargar las cuotas.' },
      { status: 500 },
    );
  }
}

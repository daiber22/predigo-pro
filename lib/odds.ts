import { buildMockOdds } from '@/lib/mock-data';
import { allowDemoFallback } from '@/lib/env';
import { FixtureMatch, OddsMarketKey, OddsResponse } from '@/lib/types';

const API_KEY = process.env.ODDS_API_KEY;
const API_BASE = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';
const DEFAULT_REGIONS = 'eu,uk';
const DEMO_FALLBACK = allowDemoFallback();

type OddsLookupOptions = {
  bookmakerKey?: string;
  comparisonMarkets?: OddsMarketKey[];
};

type OddsEvent = {
  id?: string;
  home_team?: string;
  away_team?: string;
  commence_time?: string;
  bookmakers?: Array<{
    key?: string;
    title?: string;
    markets?: Array<{
      key?: string;
      outcomes?: Array<{
        name?: string;
        price?: number;
        point?: number;
      }>;
    }>;
  }>;
};

type OddsBookmaker = NonNullable<OddsEvent['bookmakers']>[number];
type OddsMarket = NonNullable<OddsBookmaker['markets']>[number];

function normalizeText(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreName(expected?: string, actual?: string) {
  const e = normalizeText(expected);
  const a = normalizeText(actual);
  if (!e || !a) return 0;
  if (e === a) return 120;
  if (a.includes(e) || e.includes(a)) return 75;

  const eTokens = e.split(' ');
  const aTokens = a.split(' ');
  const shared = eTokens.filter((token) => aTokens.includes(token)).length;
  return shared * 15;
}

function scoreKickoff(expected?: string, actual?: string) {
  if (!expected || !actual) return 0;
  const left = new Date(expected).getTime();
  const right = new Date(actual).getTime();
  if (Number.isNaN(left) || Number.isNaN(right)) return 0;

  const diffHours = Math.abs(left - right) / (1000 * 60 * 60);
  if (diffHours <= 3) return 45;
  if (diffHours <= 12) return 25;
  if (diffHours <= 24) return 10;
  return 0;
}

function pickBestEvent(events: OddsEvent[], fixture: FixtureMatch) {
  return (events || [])
    .map((event) => ({
      event,
      score:
        scoreName(fixture.stats.homeTeam, event.home_team) +
        scoreName(fixture.stats.awayTeam, event.away_team) +
        scoreKickoff(fixture.matchDate, event.commence_time),
    }))
    .sort((a, b) => b.score - a.score)[0]?.event;
}

function findMarket(bookmaker: OddsBookmaker | undefined, key: string) {
  return bookmaker?.markets?.find((market) => market.key === key);
}

function findOutcomePriceByName(
  market: OddsMarket | undefined,
  expectedName: string,
  aliases: string[] = [],
) {
  const candidates = [expectedName, ...aliases].map(normalizeText);
  return market?.outcomes?.find((outcome) => candidates.includes(normalizeText(outcome.name)))?.price;
}

function findTotalPrice(bookmaker: OddsBookmaker | undefined, label: 'over' | 'under', point: number) {
  const totalsMarkets = bookmaker?.markets?.filter((market) => market.key === 'totals') || [];
  for (const market of totalsMarkets) {
    const outcome = market.outcomes?.find((item) => {
      const name = normalizeText(item.name);
      return name === label && Number(item.point) === point;
    });
    if (outcome?.price) return outcome.price;
  }
  return undefined;
}

function findDoubleChancePrice(bookmaker: OddsBookmaker | undefined, side: 'home_or_draw' | 'away_or_draw') {
  const market = bookmaker?.markets?.find((item) => item.key === 'double_chance');
  if (!market) return undefined;

  const matchers =
    side === 'home_or_draw'
      ? ['home or draw', '1x', 'local o empate']
      : ['away or draw', 'x2', 'visitante o empate'];

  return market.outcomes?.find((item) => matchers.includes(normalizeText(item.name)))?.price;
}

function buildApiMarkets(comparisonMarkets: OddsMarketKey[]) {
  const requested = new Set<string>();
  if (comparisonMarkets.includes('1x2')) requested.add('h2h');
  if (comparisonMarkets.includes('totals')) requested.add('totals');
  if (comparisonMarkets.includes('btts')) requested.add('btts');
  if (comparisonMarkets.includes('double_chance')) requested.add('double_chance');
  return Array.from(requested);
}

function buildOddsUrl(sportKey: string, bookmakerKey: string | undefined, apiMarkets: string[]) {
  const params = new URLSearchParams({
    apiKey: API_KEY || '',
    oddsFormat: 'decimal',
  });

  if (apiMarkets.length) {
    params.set('markets', apiMarkets.join(','));
  }

  if (bookmakerKey && bookmakerKey !== 'auto') {
    params.set('bookmakers', bookmakerKey);
  } else {
    params.set('regions', DEFAULT_REGIONS);
  }

  return `${API_BASE}/sports/${sportKey}/odds?${params.toString()}`;
}

async function requestOddsEvents(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  return response;
}

function pickBookmaker(event: OddsEvent | undefined, requestedBookmakerKey?: string) {
  if (!event?.bookmakers?.length) return undefined;
  if (!requestedBookmakerKey || requestedBookmakerKey === 'auto') {
    return event.bookmakers[0];
  }
  return event.bookmakers.find((item) => item.key === requestedBookmakerKey) || event.bookmakers[0];
}

export async function getOddsForFixture(
  fixture: FixtureMatch,
  options: OddsLookupOptions = {},
): Promise<OddsResponse> {
  const comparisonMarkets = options.comparisonMarkets?.length
    ? options.comparisonMarkets
    : ['1x2', 'totals', 'btts', 'double_chance'];

  if (!API_KEY) {
    if (DEMO_FALLBACK) {
      return {
        ...buildMockOdds(fixture.fixtureId),
        requestedBookmakerKey: options.bookmakerKey || 'auto',
        requestedMarkets: comparisonMarkets,
      };
    }
    throw new Error('Falta ODDS_API_KEY. La app quedó configurada para usar cuotas reales primero.');
  }

  const sportKey = fixture.oddsSportKey || process.env.ODDS_API_SPORT_KEY;
  if (!sportKey) {
    if (DEMO_FALLBACK) {
      return {
        ...buildMockOdds(fixture.fixtureId),
        requestedBookmakerKey: options.bookmakerKey || 'auto',
        requestedMarkets: comparisonMarkets,
      };
    }
    throw new Error('La liga seleccionada no tiene sport key configurado para The Odds API.');
  }

  const apiMarkets = buildApiMarkets(comparisonMarkets);
  const featuredMarkets = apiMarkets.filter((item) => item === 'h2h' || item === 'totals');

  let response = await requestOddsEvents(buildOddsUrl(sportKey, options.bookmakerKey, apiMarkets));

  if (!response.ok && featuredMarkets.length && featuredMarkets.length !== apiMarkets.length) {
    response = await requestOddsEvents(buildOddsUrl(sportKey, options.bookmakerKey, featuredMarkets));
  }

  if (!response.ok) {
    throw new Error(`The Odds API respondió ${response.status}`);
  }

  const data = (await response.json()) as OddsEvent[];
  const event = pickBestEvent(data, fixture);
  const bookmaker = pickBookmaker(event, options.bookmakerKey);
  if (!bookmaker) {
    if (DEMO_FALLBACK) {
      return {
        ...buildMockOdds(fixture.fixtureId),
        requestedBookmakerKey: options.bookmakerKey || 'auto',
        requestedMarkets: comparisonMarkets,
      };
    }
    throw new Error('No encontré cuotas para ese cruce con la liga, hora o bookmaker seleccionados.');
  }

  const h2h = findMarket(bookmaker, 'h2h');
  const btts = findMarket(bookmaker, 'btts');

  return {
    fixtureId: fixture.fixtureId,
    bookmaker: bookmaker.title || 'Bookmaker',
    bookmakerKey: bookmaker.key,
    requestedBookmakerKey: options.bookmakerKey || 'auto',
    requestedMarkets: comparisonMarkets,
    source: 'the-odds-api',
    odds: {
      homeWin: findOutcomePriceByName(h2h, fixture.stats.homeTeam, ['home', 'local']),
      draw: findOutcomePriceByName(h2h, 'draw', ['empate', 'tie']),
      awayWin: findOutcomePriceByName(h2h, fixture.stats.awayTeam, ['away', 'visitante']),
      over15: findTotalPrice(bookmaker, 'over', 1.5),
      over25: findTotalPrice(bookmaker, 'over', 2.5),
      under25: findTotalPrice(bookmaker, 'under', 2.5),
      under35: findTotalPrice(bookmaker, 'under', 3.5),
      bttsYes: findOutcomePriceByName(btts, 'yes', ['si', 'sí']),
      bttsNo: findOutcomePriceByName(btts, 'no'),
      homeOrDraw: findDoubleChancePrice(bookmaker, 'home_or_draw'),
      awayOrDraw: findDoubleChancePrice(bookmaker, 'away_or_draw'),
    },
  };
}

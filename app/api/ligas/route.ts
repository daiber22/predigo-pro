import { NextResponse } from 'next/server';
import { LEAGUE_OPTIONS } from '@/lib/league-options';

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_BASE =
  process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';

type ApiLeagueResponseItem = {
  league: {
    id: number;
    name: string;
    type: string;
    logo?: string | null;
  };
  country?: {
    name?: string | null;
    code?: string | null;
    flag?: string | null;
  };
  seasons?: Array<{
    year: number;
    current?: boolean;
  }>;
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findMappedLeague(leagueName: string, countryName: string) {
  const leagueNorm = normalizeText(leagueName);
  const countryNorm = normalizeText(countryName);

  return (
    LEAGUE_OPTIONS.find((item) => {
      const itemLeague = normalizeText(item.label);
      const itemCountry = normalizeText(item.country);
      return itemLeague === leagueNorm && itemCountry === countryNorm;
    }) ||
    LEAGUE_OPTIONS.find((item) => {
      const itemLeague = normalizeText(item.label);
      const itemCountry = normalizeText(item.country);

      return (
        (leagueNorm.includes(itemLeague) || itemLeague.includes(leagueNorm)) &&
        itemCountry === countryNorm
      );
    })
  );
}

function buildDemoResults(search: string, season: number) {
  const query = normalizeText(search);

  return LEAGUE_OPTIONS.filter((item) => {
    const haystack = normalizeText(`${item.label} ${item.country}`);
    return haystack.includes(query);
  })
    .slice(0, 30)
    .map((item) => ({
      leagueId: null,
      leagueKey: item.key,
      league: item.label,
      country: item.country,
      season,
      logo: null,
      flag: null,
      oddsSportKey: item.oddsSportKey,
      status: item.oddsSportKey ? 'mapped' : 'missing_sport_key',
      source: 'demo',
      searchLabel: `${item.label} (${item.country})`,
    }));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = (searchParams.get('search') || '').trim();
  const season = Number(searchParams.get('season') || new Date().getFullYear());

  if (!search) {
    return NextResponse.json({
      results: [],
      source: API_KEY ? 'api-football' : 'demo',
    });
  }

  const demoResults = buildDemoResults(search, season);

  if (!API_KEY) {
    return NextResponse.json({
      results: demoResults,
      source: 'demo',
      warning: 'Falta API_FOOTBALL_KEY. Se devuelve lista local.',
    });
  }

  try {
    const response = await fetch(
      `${API_BASE}/leagues?search=${encodeURIComponent(search)}`,
      {
        headers: {
          'x-apisports-key': API_KEY,
        },
        cache: 'no-store',
      }
    );

    const payload = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.message ||
            payload?.errors ||
            'No se pudo consultar la API de ligas.',
        },
        { status: response.status }
      );
    }

    const rawItems = (payload.response || []) as ApiLeagueResponseItem[];

    const results = rawItems
      .filter((item) => item?.league?.name)
      .map((item) => {
        const country = item.country?.name || 'Sin país';
        const mapped = findMappedLeague(item.league.name, country);

        const selectedSeason =
          item.seasons?.find((entry) => entry.year === season) ||
          item.seasons?.find((entry) => entry.current) ||
          item.seasons?.[item.seasons.length - 1];

        return {
          leagueId: item.league.id,
          leagueKey: mapped?.key || `api-${item.league.id}`,
          league: item.league.name,
          country,
          season: selectedSeason?.year || season,
          logo: item.league.logo || null,
          flag: item.country?.flag || null,
          oddsSportKey: mapped?.oddsSportKey || null,
          status: mapped?.oddsSportKey ? 'mapped' : 'missing_sport_key',
          source: 'api-football',
          searchLabel: `${item.league.name} (${country})`,
        };
      });

    const uniqueResults = results.filter(
      (item, index, array) =>
        index ===
        array.findIndex(
          (other) =>
            other.leagueId === item.leagueId && other.season === item.season
        )
    );

    uniqueResults.sort((a, b) => {
      const aMapped = a.oddsSportKey ? 1 : 0;
      const bMapped = b.oddsSportKey ? 1 : 0;

      if (aMapped !== bMapped) {
        return bMapped - aMapped;
      }

      return a.searchLabel.localeCompare(b.searchLabel);
    });

    return NextResponse.json({
      results: uniqueResults.length ? uniqueResults : demoResults,
      source: uniqueResults.length ? 'api-football' : 'demo',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error inesperado buscando ligas.',
      },
      { status: 500 }
    );
  }
}

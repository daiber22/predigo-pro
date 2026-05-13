import { buildMockFixture } from '@/lib/mock-data';
import { getLeagueOption } from '@/lib/league-options';
import { allowDemoFallback } from '@/lib/env';
import { FixtureMatch, TeamSearchInput } from '@/lib/types';

const API_BASE = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const API_KEY = process.env.API_FOOTBALL_KEY;
const DEMO_FALLBACK = allowDemoFallback();

type ApiFootballTeamCandidate = {
  team?: {
    id?: number;
    name?: string;
    country?: string;
  };
};

type ApiFootballLeagueCandidate = {
  league?: {
    id?: number;
    name?: string;
  };
  country?: {
    name?: string;
  };
  seasons?: Array<{
    year?: number;
    current?: boolean;
  }>;
};

type ApiFootballFixture = {
  fixture?: {
    id?: number;
    date?: string;
    status?: {
      short?: string;
    };
  };
  league?: {
    id?: number;
    name?: string;
    country?: string;
    round?: string;
  };
  teams?: {
    home?: {
      id?: number;
      name?: string;
    };
    away?: {
      id?: number;
      name?: string;
    };
  };
};

async function fetchApiFootball(path: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'x-apisports-key': API_KEY || '',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`API-Football respondió ${response.status}`);
  }

  return response.json();
}

function normalizeText(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function scoreName(query: string, candidate: string) {
  const q = normalizeText(query);
  const c = normalizeText(candidate);

  if (!q || !c) return 0;
  if (q === c) return 120;
  if (c.startsWith(q) || q.startsWith(c)) return 90;
  if (c.includes(q) || q.includes(c)) return 70;

  const queryTokens = q.split(' ');
  const candidateTokens = c.split(' ');
  const shared = queryTokens.filter((token) => candidateTokens.includes(token)).length;
  return shared * 15;
}

function scoreCountry(expected?: string, actual?: string) {
  if (!expected || !actual) return 0;
  return normalizeText(expected) === normalizeText(actual) ? 35 : 0;
}

function selectTeamCandidate(candidates: ApiFootballTeamCandidate[], teamName: string, country?: string) {
  return safeArray(candidates)
    .map((candidate) => ({
      candidate,
      score:
        scoreName(teamName, candidate.team?.name || '') +
        scoreCountry(country, candidate.team?.country),
    }))
    .sort((a, b) => b.score - a.score)[0]?.candidate;
}

function selectLeagueCandidate(candidates: ApiFootballLeagueCandidate[], league?: string, country?: string, season?: number) {
  return safeArray(candidates)
    .map((candidate) => ({
      candidate,
      score:
        scoreName(league || '', candidate.league?.name || '') +
        scoreCountry(country, candidate.country?.name) +
        (candidate.seasons?.some((item) => item.year === season && item.current) ? 10 : 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.candidate;
}

function isScheduledStatus(status?: string) {
  return ['TBD', 'NS', 'PST'].includes(status || '');
}

function dateDistanceScore(targetDate: string | undefined, candidateDate: string | undefined) {
  if (!targetDate || !candidateDate) return 0;

  const target = new Date(targetDate).getTime();
  const candidate = new Date(candidateDate).getTime();
  if (Number.isNaN(target) || Number.isNaN(candidate)) return 0;

  const diffDays = Math.abs(target - candidate) / (1000 * 60 * 60 * 24);
  if (diffDays < 0.5) return 60;
  if (diffDays < 1.5) return 45;
  if (diffDays < 3) return 25;
  if (diffDays < 7) return 10;
  return 0;
}

function chooseFixture(fixtures: ApiFootballFixture[], awayTeamId?: number, input?: TeamSearchInput, leagueId?: number) {
  return safeArray(fixtures)
    .map((fixture) => {
      const awayMatch = fixture.teams?.away?.id === awayTeamId ? 120 : 0;
      const homeMatch = normalizeText(fixture.teams?.home?.name) === normalizeText(input?.homeTeam) ? 40 : 0;
      const leagueMatch = leagueId && fixture.league?.id === leagueId ? 30 : 0;
      const statusScore = isScheduledStatus(fixture.fixture?.status?.short) ? 20 : 10;
      const kickoffScore = dateDistanceScore(input?.matchDate, fixture.fixture?.date);

      return {
        fixture,
        score: awayMatch + homeMatch + leagueMatch + statusScore + kickoffScore,
      };
    })
    .sort((a, b) => b.score - a.score)[0]?.fixture;
}

async function findTeam(teamName: string, country?: string) {
  const response = await fetchApiFootball(`/teams?search=${encodeURIComponent(teamName)}`);
  return selectTeamCandidate(response.response, teamName, country)?.team;
}

async function findLeague(input: TeamSearchInput, season: number) {
  if (!input.league) return undefined;

  const params = new URLSearchParams({
    search: input.league,
    season: String(season),
  });

  if (input.country) {
    params.set('country', input.country);
  }

  const response = await fetchApiFootball(`/leagues?${params.toString()}`);
  return selectLeagueCandidate(response.response, input.league, input.country, season)?.league;
}

async function findFixture(homeTeamId: number, awayTeamId: number, season: number, leagueId: number | undefined, input: TeamSearchInput) {
  const queryBase = new URLSearchParams({
    season: String(season),
  });

  if (leagueId) {
    queryBase.set('league', String(leagueId));
  }

  const candidateGroups: ApiFootballFixture[][] = [];

  try {
    const headToHead = await fetchApiFootball(
      `/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&${queryBase.toString()}`,
    );
    candidateGroups.push(safeArray(headToHead.response));
  } catch {
    // Se ignora y se usan fallbacks.
  }

  try {
    const nextFixtures = await fetchApiFootball(
      `/fixtures?team=${homeTeamId}&next=20&${queryBase.toString()}`,
    );
    candidateGroups.push(safeArray(nextFixtures.response));
  } catch {
    // sin-op
  }

  try {
    const lastFixtures = await fetchApiFootball(
      `/fixtures?team=${homeTeamId}&last=20&${queryBase.toString()}`,
    );
    candidateGroups.push(safeArray(lastFixtures.response));
  } catch {
    // sin-op
  }

  const candidates = candidateGroups.flat();
  return chooseFixture(candidates, awayTeamId, input, leagueId);
}

function scaleToLast5(goals: number, matches: number) {
  if (!matches) return 0;
  return Number(((goals / matches) * 5).toFixed(2));
}

export async function searchFixtureWithStats(input: TeamSearchInput): Promise<FixtureMatch> {
  const leagueOption = getLeagueOption(input.leagueKey);
  const resolvedInput: TeamSearchInput = {
    ...input,
    league: input.league || leagueOption?.league,
    country: input.country || leagueOption?.country,
    season: input.season || leagueOption?.defaultSeason || Number(process.env.DEFAULT_SEASON || 2026),
  };

  if (!API_KEY) {
    if (DEMO_FALLBACK) {
      return buildMockFixture(resolvedInput);
    }
    throw new Error('Falta API_FOOTBALL_KEY. La app quedó configurada para usar API real primero.');
  }

  try {
    const season = resolvedInput.season || Number(process.env.DEFAULT_SEASON || 2026);
    const [home, away, league] = await Promise.all([
      findTeam(resolvedInput.homeTeam, resolvedInput.country),
      findTeam(resolvedInput.awayTeam, resolvedInput.country),
      findLeague(resolvedInput, season),
    ]);

    if (!home?.id || !away?.id || !home.name || !away.name) {
      if (DEMO_FALLBACK) {
        return buildMockFixture(resolvedInput);
      }
      throw new Error('No pude resolver los dos equipos en API-Football. Revisa nombres, liga o país.');
    }
const preferredLeagueId =
  resolvedInput.leagueKey === 'colombia-primera-a' ? 239 : league?.id;
 const fixture = await findFixture(home.id, away.id, season, preferredLeagueId, resolvedInput);
    const resolvedLeagueId = fixture?.league?.id || preferredLeagueId;

    if (!resolvedLeagueId) {
      if (DEMO_FALLBACK) {
        return buildMockFixture(resolvedInput);
      }
      throw new Error('No pude resolver la liga o fixture real para ese cruce.');
    }

    const [homeStats, awayStats] = await Promise.all([
      fetchApiFootball(`/teams/statistics?league=${resolvedLeagueId}&season=${season}&team=${home.id}`),
      fetchApiFootball(`/teams/statistics?league=${resolvedLeagueId}&season=${season}&team=${away.id}`),
    ]);
const homeResp = Array.isArray(homeStats?.response)
  ? homeStats.response[0]
  : homeStats?.response || homeStats;
   
    const awayResp = Array.isArray(awayStats?.response)
  ? awayStats.response[0]
  : awayStats?.response || awayStats;
const homeCount = Array.isArray(homeStats?.response)
  ? homeStats.response.length
  : homeStats?.response ? 1 : 0;

const awayCount = Array.isArray(awayStats?.response)
  ? awayStats.response.length
  : awayStats?.response ? 1 : 0;

if (!homeResp || !awayResp) {
  throw new Error(
    `Stats vacias API-Football | league=${resolvedLeagueId} season=${season} homeTeam=${home?.id} awayTeam=${away?.id} homeCount=${homeCount} awayCount=${awayCount}`
  );
}
    const homeForGeneral = Number(homeResp?.goals?.for?.total?.total ?? 0);
    const homeAgainstGeneral = Number(homeResp?.goals?.against?.total?.total ?? 0);
    const homeMatchesGeneral = Number(homeResp?.fixtures?.played?.total ?? 1);
    const homeForHome = Number(homeResp?.goals?.for?.total?.home ?? 0);
    const homeAgainstHome = Number(homeResp?.goals?.against?.total?.home ?? 0);
    const homeMatchesHome = Number(homeResp?.fixtures?.played?.home ?? 1);

    const awayForGeneral = Number(awayResp?.goals?.for?.total?.total ?? 0);
    const awayAgainstGeneral = Number(awayResp?.goals?.against?.total?.total ?? 0);
    const awayMatchesGeneral = Number(awayResp?.fixtures?.played?.total ?? 1);
    const awayForAway = Number(awayResp?.goals?.for?.total?.away ?? 0);
    const awayAgainstAway = Number(awayResp?.goals?.against?.total?.away ?? 0);
    const awayMatchesAway = Number(awayResp?.fixtures?.played?.away ?? 1);

    return {
      fixtureId: String(fixture?.fixture?.id || `${home.id}-${away.id}-${season}`),
      leagueKey: resolvedInput.leagueKey,
      oddsSportKey: leagueOption?.oddsSportKey || process.env.ODDS_API_SPORT_KEY || undefined,
      homeTeamId: home.id,
      awayTeamId: away.id,
      leagueId: resolvedLeagueId,
      leagueName: fixture?.league?.name || league?.name || resolvedInput.league || process.env.DEFAULT_LEAGUE || 'Liga detectada',
      country: fixture?.league?.country || resolvedInput.country,
      season,
      round: fixture?.league?.round,
      matchDate: fixture?.fixture?.date || resolvedInput.matchDate,
      source: 'api-football',
      stats: {
        homeTeam: home.name,
        awayTeam: away.name,
        homeGoalsForGeneral: scaleToLast5(homeForGeneral, homeMatchesGeneral),
        homeGoalsAgainstGeneral: scaleToLast5(homeAgainstGeneral, homeMatchesGeneral),
        homeGoalsForHome: scaleToLast5(homeForHome, homeMatchesHome),
        homeGoalsAgainstHome: scaleToLast5(homeAgainstHome, homeMatchesHome),
        awayGoalsForGeneral: scaleToLast5(awayForGeneral, awayMatchesGeneral),
        awayGoalsAgainstGeneral: scaleToLast5(awayAgainstGeneral, awayMatchesGeneral),
        awayGoalsForAway: scaleToLast5(awayForAway, awayMatchesAway),
        awayGoalsAgainstAway: scaleToLast5(awayAgainstAway, awayMatchesAway),
        homeShotsOnTargetGeneral: 0,
homeBlockedShotsGeneral: 0,
homeShotsOnTargetHome: 0,
homeBlockedShotsHome: 0,
awayShotsOnTargetGeneral: 0,
awayBlockedShotsGeneral: 0,
awayShotsOnTargetAway: 0,
awayBlockedShotsAway: 0,
      },
    };
  } catch (error) {
    if (DEMO_FALLBACK) {
      return buildMockFixture(resolvedInput);
    }
    throw error instanceof Error ? error : new Error('No se pudo consultar API-Football.');
  }
}

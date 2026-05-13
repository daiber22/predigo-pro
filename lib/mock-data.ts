import { FixtureMatch, OddsResponse, TeamSearchInput } from '@/lib/types';
import { getLeagueOption } from '@/lib/league-options';

const slug = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export function buildMockFixture(input: TeamSearchInput): FixtureMatch {
  const homeTeam = input.homeTeam || 'Equipo Local';
  const awayTeam = input.awayTeam || 'Equipo Visitante';
  const fixtureId = `${slug(homeTeam)}-vs-${slug(awayTeam)}`;
  const option = getLeagueOption(input.leagueKey);

  return {
    fixtureId,
    leagueKey: input.leagueKey,
    oddsSportKey: option?.oddsSportKey || process.env.ODDS_API_SPORT_KEY || undefined,
    leagueId: 1001,
    leagueName: input.league || option?.league || process.env.DEFAULT_LEAGUE || 'Colombia Primera A',
    country: input.country || option?.country || process.env.DEFAULT_COUNTRY || 'Colombia',
    season: input.season || option?.defaultSeason || Number(process.env.DEFAULT_SEASON || 2026),
    round: 'Jornada simulada',
    matchDate: input.matchDate || new Date().toISOString().slice(0, 10),
    homeTeamId: 11,
    awayTeamId: 22,
    source: 'mock',
    stats: {
      homeTeam,
      awayTeam,
      homeGoalsForGeneral: 8,
      homeGoalsAgainstGeneral: 5,
      homeGoalsForHome: 7,
      homeGoalsAgainstHome: 4,
      awayGoalsForGeneral: 10,
      awayGoalsAgainstGeneral: 5,
      awayGoalsForAway: 8,
      awayGoalsAgainstAway: 4,
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
}

export function buildMockOdds(fixtureId: string): OddsResponse {
  return {
    fixtureId,
    bookmaker: 'MockBook',
    bookmakerKey: 'auto',
    requestedBookmakerKey: 'auto',
    requestedMarkets: ['1x2', 'totals', 'btts', 'double_chance'],
    source: 'mock',
    odds: {
      homeWin: 2.2,
      draw: 3.1,
      awayWin: 3.35,
      over15: 1.3,
      over25: 1.92,
      under25: 1.88,
      under35: 1.33,
      bttsYes: 1.95,
      bttsNo: 1.8,
      homeOrDraw: 1.34,
      awayOrDraw: 1.72,
    },
  };
}

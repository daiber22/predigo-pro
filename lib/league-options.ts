export type LeagueOption = {
  key: string;
  label: string;
  league: string;
  country: string;
  oddsSportKey?: string;
  defaultSeason: number;
};

export const LEAGUE_OPTIONS: LeagueOption[] = [
  {
    key: 'colombia-primera-a',
    label: 'Colombia Primera A',
    league: 'Primera A',
    country: 'Colombia',
    oddsSportKey: undefined,
    defaultSeason: 2026,
  },
  {
    key: 'spain-la-liga',
    label: 'La Liga',
    league: 'La Liga',
    country: 'Spain',
    oddsSportKey: 'soccer_spain_la_liga',
    defaultSeason: 2026,
  },
  {
    key: 'england-premier-league',
    label: 'Premier League',
    league: 'Premier League',
    country: 'England',
    oddsSportKey: 'soccer_epl',
    defaultSeason: 2026,
  },
  {
    key: 'italy-serie-a',
    label: 'Serie A',
    league: 'Serie A',
    country: 'Italy',
    oddsSportKey: 'soccer_italy_serie_a',
    defaultSeason: 2026,
  },
  {
    key: 'france-ligue-1',
    label: 'Ligue 1',
    league: 'Ligue 1',
    country: 'France',
    oddsSportKey: 'soccer_france_ligue_one',
    defaultSeason: 2026,
  },
  {
    key: 'germany-bundesliga',
    label: 'Bundesliga',
    league: 'Bundesliga',
    country: 'Germany',
    oddsSportKey: 'soccer_germany_bundesliga',
    defaultSeason: 2026,
  },
  {
    key: 'brazil-serie-a',
    label: 'Brasil Série A',
    league: 'Serie A',
    country: 'Brazil',
    oddsSportKey: 'soccer_brazil_campeonato',
    defaultSeason: 2026,
  },
  {
    key: 'argentina-primera',
    label: 'Argentina Primera División',
    league: 'Primera Division',
    country: 'Argentina',
    oddsSportKey: 'soccer_argentina_primera_division',
    defaultSeason: 2026,
  },
  {
    key: 'mexico-liga-mx',
    label: 'Liga MX',
    league: 'Liga MX',
    country: 'Mexico',
    oddsSportKey: 'soccer_mexico_ligamx',
    defaultSeason: 2026,
  },
  {
    key: 'usa-mls',
    label: 'MLS',
    league: 'Major League Soccer',
    country: 'USA',
    oddsSportKey: 'soccer_usa_mls',
    defaultSeason: 2026,
  },
];

export function getLeagueOption(key?: string) {
  if (!key) return undefined;
  return LEAGUE_OPTIONS.find((item) => item.key === key);
}

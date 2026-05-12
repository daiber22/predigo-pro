export type TeamSearchInput = {
  homeTeam: string;
  awayTeam: string;
  leagueKey?: string;
  league?: string;
  country?: string;
  season?: number;
  matchDate?: string;
};

export type TeamStatsInput = {
  homeTeam: string;
  awayTeam: string;
  homeGoalsForGeneral: number;
  homeGoalsAgainstGeneral: number;
  homeGoalsForHome: number;
  homeGoalsAgainstHome: number;
  awayGoalsForGeneral: number;
  awayGoalsAgainstGeneral: number;
  awayGoalsForAway: number;
  awayGoalsAgainstAway: number;
};

export type OddsMarketKey = '1x2' | 'totals' | 'btts' | 'double_chance';

export type TicketProfile = 'conservador' | 'medio' | 'agresivo';

export type FixtureMatch = {
  fixtureId: string;
  leagueKey?: string;
  oddsSportKey?: string;
  leagueId?: number;
  leagueName: string;
  country?: string;
  season?: number;
  round?: string;
  matchDate?: string;
  homeTeamId?: number;
  awayTeamId?: number;
  stats: TeamStatsInput;
  source: 'mock' | 'api-football';
};

export type ScorelineProbability = {
  score: string;
  probability: number;
};

export type MarketSignal = 'verde' | 'amarillo' | 'rojo';

export type ComparisonRow = {
  marketKey: OddsMarketKey;
  market: string;
  selection: string;
  odd: number;
  impliedProbability: number;
  modelProbability: number;
  edge: number;
  signal: MarketSignal;
};

export type OddsResponse = {
  fixtureId: string;
  bookmaker: string;
  bookmakerKey?: string;
  requestedBookmakerKey?: string;
  requestedMarkets?: OddsMarketKey[];
  odds: {
    homeWin?: number;
    draw?: number;
    awayWin?: number;
    over15?: number;
    over25?: number;
    under25?: number;
    under35?: number;
    bttsYes?: number;
    bttsNo?: number;
    homeOrDraw?: number;
    awayOrDraw?: number;
  };
  source: 'mock' | 'the-odds-api';
};

export type AnalysisResult = {
  fixtureId?: string;
  homeTeam: string;
  awayTeam: string;
  attackHome: number;
  defenseHome: number;
  attackAway: number;
  defenseAway: number;
  lambdaHome: number;
  lambdaAway: number;
  totalLambda: number;
  br: number;
  typeBase: 'Corto' | 'Medio' | 'Abierto';
  sideBase: 'A' | 'B' | 'X';
  marketBase: string;
  baseResult: string;
  p1: number;
  px: number;
  p2: number;
  over15: number;
  btts: number;
  under25: number;
  under35: number;
  poissonMarket: string;
  poissonTop1: string;
  poissonTop2: string;
  poissonTop3: string;
  confidence: 'Alta' | 'Media' | 'Baja';
  scorelines: ScorelineProbability[];
  recommendation: {
    mainPick: string;
    conservativePick: string;
    aggressivePick: string;
  };
  comparisons: ComparisonRow[];
};

export type TicketItem = {
  id: string;
  fixtureId?: string;
  homeTeam: string;
  awayTeam: string;
  market?: string;
  pick: string;
  odd: number;
  confidence: AnalysisResult['confidence'];
  edge?: number;
  bookmaker?: string;
  createdAt: string;
  profile?: TicketProfile;
  rationale?: string;
};

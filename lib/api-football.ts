// lib/api-football.ts

export const API_KEY = process.env.API_FOOTBALL_KEY || "";
export const BASE_URL =
  process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";

export function norm(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const TEAM_ALIASES: Record<string, string> = {
  junior: "Junior FC",
  "junior fc": "Junior FC",
  "once caldas": "Once Caldas",
  pasto: "Deportivo Pasto",
  "deportivo pasto": "Deportivo Pasto",
  tolima: "Deportes Tolima",
  "deportes tolima": "Deportes Tolima",
  "atletico nacional": "Atletico Nacional",
  nacional: "Atletico Nacional",
  "america de cali": "America de Cali",
  america: "America de Cali",
  "independiente santa fe": "Santa Fe",
  "santa fe": "Santa Fe",
  millonarios: "Millonarios",
};

export function canonicalTeamName(name: string) {
  const key = norm(name);
  return TEAM_ALIASES[key] || name;
}

export async function apiFootball(
  path: string,
  params: Record<string, string> = {}
) {
  if (!API_KEY) {
    throw new Error("Falta API_FOOTBALL_KEY en variables de entorno");
  }

  const url = new URL(`${BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (`${value}`.trim() !== "") {
      url.searchParams.set(key, value);
    }
  });

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-apisports-key": API_KEY,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    throw new Error(
      `API-Football ${res.status}: ${
        json?.message || json?.errors || text || "Error sin detalle"
      }`
    );
  }

  if (json?.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }

  return json;
}

export async function resolveLeagueId(
  league: string,
  country: string,
  season: string
) {
  const data = await apiFootball("/leagues", {
    search: league,
    country,
    season,
  });

  const list = data?.response || [];
  const targetLeague = norm(league);
  const targetCountry = norm(country);

  const exact = list.find(
    (x: any) =>
      norm(x?.league?.name || "") === targetLeague &&
      norm(x?.country?.name || "") === targetCountry
  );

  if (exact) {
    return exact.league.id;
  }

  const countryMatch = list.find(
    (x: any) => norm(x?.country?.name || "") === targetCountry
  );

  if (countryMatch) {
    return countryMatch.league.id;
  }

  throw new Error(
    `No encontré la liga "${league}" en país "${country}" para temporada ${season}`
  );
}

export async function resolveTeamId(
  teamName: string,
  leagueId: string,
  season: string
) {
  const canonical = canonicalTeamName(teamName);

  const scoped = await apiFootball("/teams", {
    search: canonical,
    league: leagueId,
    season,
  });

  const response = scoped?.response || [];
  const exact = response.find(
    (item: any) => norm(item?.team?.name || "") === norm(canonical)
  );

  if (exact) {
    return exact.team.id;
  }

  const includes = response.find((item: any) =>
    norm(item?.team?.name || "").includes(norm(canonical))
  );

  if (includes) {
    return includes.team.id;
  }

  const global = await apiFootball("/teams", {
    search: canonical,
  });

  const globalResponse = global?.response || [];
  const globalExact = globalResponse.find(
    (item: any) => norm(item?.team?.name || "") === norm(canonical)
  );

  if (globalExact) {
    return globalExact.team.id;
  }

  const globalIncludes = globalResponse.find((item: any) =>
    norm(item?.team?.name || "").includes(norm(canonical))
  );

  if (globalIncludes) {
    return globalIncludes.team.id;
  }

  throw new Error(`No encontré el equipo "${teamName}"`);
}

export function buildDateRange(matchDate?: string) {
  if (!matchDate) return null;

  const base = new Date(matchDate);
  if (Number.isNaN(base.getTime())) return null;

  const from = new Date(base);
  from.setDate(from.getDate() - 3);

  const to = new Date(base);
  to.setDate(to.getDate() + 3);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return {
    from: fmt(from),
    to: fmt(to),
  };
}

export async function findFixtureByInput(input: {
  league: string;
  country: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  matchDate?: string;
}) {
  const leagueId = await resolveLeagueId(
    input.league,
    input.country,
    input.season
  );

  const homeId = await resolveTeamId(input.homeTeam, String(leagueId), input.season);
  const awayId = await resolveTeamId(input.awayTeam, String(leagueId), input.season);

  let fixtures: any[] = [];

  const range = buildDateRange(input.matchDate);

  if (range) {
    const byDate = await apiFootball("/fixtures", {
      league: String(leagueId),
      season: input.season,
      from: range.from,
      to: range.to,
    });

    fixtures = byDate?.response || [];
  }

  if (fixtures.length === 0) {
    const byHome = await apiFootball("/fixtures", {
      league: String(leagueId),
      season: input.season,
      team: String(homeId),
      last: "50",
    });

    fixtures = byHome?.response || [];
  }

  const exact = fixtures.find((f: any) => {
    const h = f?.teams?.home?.id;
    const a = f?.teams?.away?.id;
    return h === homeId && a === awayId;
  });

  return {
    leagueId,
    homeId,
    awayId,
    fixture: exact || null,
    fixturesChecked: fixtures.length,
  };
}

export function teamStatsSummary(stats: any) {
  const playedHome = Number(stats?.fixtures?.played?.home || 0);
  const playedAway = Number(stats?.fixtures?.played?.away || 0);
  const gfHome = Number(stats?.goals?.for?.total?.home || 0);
  const gfAway = Number(stats?.goals?.for?.total?.away || 0);
  const gaHome = Number(stats?.goals?.against?.total?.home || 0);
  const gaAway = Number(stats?.goals?.against?.total?.away || 0);

  return {
    home: {
      played: playedHome,
      gf: gfHome,
      ga: gaHome,
      gfAvg: playedHome ? gfHome / playedHome : 0,
      gaAvg: playedHome ? gaHome / playedHome : 0,
    },
    away: {
      played: playedAway,
      gf: gfAway,
      ga: gaAway,
      gfAvg: playedAway ? gfAway / playedAway : 0,
      gaAvg: playedAway ? gaAway / playedAway : 0,
    },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function poisson(k: number, lambda: number) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function factorial(n: number) {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

export function buildPrediction(homeStats: any, awayStats: any) {
  const h = teamStatsSummary(homeStats);
  const a = teamStatsSummary(awayStats);

  const lambdaHome = clamp((h.home.gfAvg + a.away.gaAvg) / 2 || 0.8, 0.15, 3.5);
  const lambdaAway = clamp((a.away.gfAvg + h.home.gaAvg) / 2 || 0.8, 0.15, 3.5);

  const maxGoals = 5;
  const matrix: { home: number; away: number; prob: number }[] = [];

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let over25 = 0;
  let btts = 0;

  for (let i = 0; i <= maxGoals; i += 1) {
    for (let j = 0; j <= maxGoals; j += 1) {
      const prob = poisson(i, lambdaHome) * poisson(j, lambdaAway);
      matrix.push({ home: i, away: j, prob });

      if (i > j) homeWin += prob;
      if (i === j) draw += prob;
      if (i < j) awayWin += prob;
      if (i + j >= 3) over25 += prob;
      if (i >= 1 && j >= 1) btts += prob;
    }
  }

  const topScores = [...matrix]
    .sort((x, y) => y.prob - x.prob)
    .slice(0, 5)
    .map((item) => ({
      score: `${item.home}-${item.away}`,
      probability: item.prob,
    }));

  const best = topScores[0];

  return {
    lambdaHome,
    lambdaAway,
    probabilities: {
      homeWin,
      draw,
      awayWin,
      over25,
      under25: 1 - over25,
      btts,
      noBtts: 1 - btts,
    },
    topScores,
    predictedScore: best?.score || "0-0",
  };
}


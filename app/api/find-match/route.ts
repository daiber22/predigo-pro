import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_KEY = process.env.API_FOOTBALL_KEY || "";
const BASE_URL =
  process.env.API_FOOTBALL_BASE_URL || "https://v3.football.api-sports.io";

function norm(value: string) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const TEAM_ALIASES: Record<string, string> = {
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

function canonicalTeamName(name: string) {
  const key = norm(name);
  return TEAM_ALIASES[key] || name;
}

async function apiFootball(
  path: string,
  params: Record<string, string> = {}
) {
  if (!API_KEY) {
    throw new Error("Falta API_FOOTBALL_KEY en Vercel");
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

  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`La API devolvió algo no válido: ${text.slice(0, 120)}`);
  }

  if (!res.ok) {
    throw new Error(
      `API-Football ${res.status}: ${
        json?.message || JSON.stringify(json?.errors || {}) || "sin detalle"
      }`
    );
  }

  if (json?.errors && Object.keys(json.errors).length > 0) {
    throw new Error(`API-Football error: ${JSON.stringify(json.errors)}`);
  }

  return json;
}

async function resolveLeagueId(league: string, country: string, season: string) {
  const byCountry = await apiFootball("/leagues", {
    country,
    season,
  });

  const list = byCountry?.response || [];
  const targetLeague = norm(league);

  const exact = list.find((x: any) => norm(x?.league?.name || "") === targetLeague);
  if (exact) return exact.league.id;

  const contains = list.find((x: any) => {
    const apiLeague = norm(x?.league?.name || "");
    return (
      targetLeague.includes(apiLeague) ||
      apiLeague.includes(targetLeague) ||
      (targetLeague.includes("primera a") && apiLeague.includes("primera a"))
    );
  });

  if (contains) return contains.league.id;

  throw new Error(`No encontré la liga "${league}" en ${country}`);
}

async function resolveTeamId(teamName: string, leagueId: string, season: string) {
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

  if (exact) return exact.team.id;

  const includes = response.find((item: any) =>
    norm(item?.team?.name || "").includes(norm(canonical))
  );

  if (includes) return includes.team.id;

  throw new Error(`No encontré el equipo "${teamName}"`);
}

function buildDateRange(matchDate?: string) {
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const league = String(body?.league || "").trim();
    const country = String(body?.country || "").trim();
    const season = String(body?.season || "").trim();
    const homeTeam = String(body?.homeTeam || "").trim();
    const awayTeam = String(body?.awayTeam || "").trim();
    const matchDate = String(body?.matchDate || "").trim();

    if (!league || !country || !season || !homeTeam || !awayTeam) {
      return NextResponse.json(
        {
          ok: false,
          error: "Faltan datos obligatorios",
        },
        { status: 400 }
      );
    }

    const leagueId = await resolveLeagueId(league, country, season);
    const homeId = await resolveTeamId(homeTeam, String(leagueId), season);
    const awayId = await resolveTeamId(awayTeam, String(leagueId), season);

    let fixtures: any[] = [];
    const range = buildDateRange(matchDate);

    if (range) {
      const byDate = await apiFootball("/fixtures", {
        league: String(leagueId),
        season,
        from: range.from,
        to: range.to,
      });

      fixtures = byDate?.response || [];
    }

    if (fixtures.length === 0) {
      const byHome = await apiFootball("/fixtures", {
        league: String(leagueId),
        season,
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

    if (!exact) {
      return NextResponse.json(
        {
          ok: false,
          error: "No encontré el fixture exacto",
          debug: {
            leagueId,
            homeId,
            awayId,
            revisados: fixtures.length,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      fixtureId: exact?.fixture?.id,
      leagueId,
      homeId,
      awayId,
      fixture: {
        date: exact?.fixture?.date || "",
        venue: exact?.fixture?.venue?.name || "",
        status: exact?.fixture?.status?.long || "",
        league: exact?.league?.name || "",
        country: exact?.league?.country || "",
        home: exact?.teams?.home?.name || "",
        away: exact?.teams?.away?.name || "",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Error buscando partido",
      },
      { status: 500 }
    );
  }
}

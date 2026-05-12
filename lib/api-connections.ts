import { getLeagueOption, LEAGUE_OPTIONS } from '@/lib/league-options';
import { allowDemoFallback, requireEnv } from '@/lib/env';

const API_FOOTBALL_BASE = process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
const ODDS_API_BASE = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';

export type ConnectionCheckResult = {
  demoFallback: boolean;
  apiFootball: {
    configured: boolean;
    ok: boolean;
    message: string;
  };
  oddsApi: {
    configured: boolean;
    ok: boolean;
    message: string;
    sportKey?: string;
    sportKeyAvailable?: boolean;
  };
};

export type LeagueQuotaStatus = {
  leagueKey: string;
  label: string;
  sportKey?: string;
  status: 'ok' | 'missing_sport_key' | 'unavailable' | 'unchecked';
  message: string;
};

export type LeagueStatusResult = {
  checkedAt: string;
  oddsApiConfigured: boolean;
  leagueStatuses: LeagueQuotaStatus[];
};

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchAvailableSportKeys() {
  const oddsApiKey = requireEnv('ODDS_API_KEY');
  const response = await fetch(`${ODDS_API_BASE}/sports/?apiKey=${encodeURIComponent(oddsApiKey)}`, {
    cache: 'no-store',
  });
  const payload = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error(`The Odds API respondió ${response.status}.`);
  }

  if (!Array.isArray(payload)) {
    throw new Error('The Odds API respondió, pero no devolvió la lista de sports.');
  }

  return new Set<string>(payload.map((item: any) => item?.key).filter(Boolean));
}

export async function checkApiConnections(leagueKey?: string): Promise<ConnectionCheckResult> {
  const demoFallback = allowDemoFallback();
  const league = getLeagueOption(leagueKey);
  const result: ConnectionCheckResult = {
    demoFallback,
    apiFootball: {
      configured: Boolean(process.env.API_FOOTBALL_KEY),
      ok: false,
      message: 'Sin revisar todavía.',
    },
    oddsApi: {
      configured: Boolean(process.env.ODDS_API_KEY),
      ok: false,
      message: 'Sin revisar todavía.',
      sportKey: league?.oddsSportKey || process.env.ODDS_API_SPORT_KEY || undefined,
      sportKeyAvailable: undefined,
    },
  };

  if (!result.apiFootball.configured) {
    result.apiFootball.message = 'Falta API_FOOTBALL_KEY.';
  } else {
    try {
      const apiFootballKey = requireEnv('API_FOOTBALL_KEY');
      const response = await fetch(`${API_FOOTBALL_BASE}/countries`, {
        headers: { 'x-apisports-key': apiFootballKey },
        cache: 'no-store',
      });
      const payload = await parseJsonSafe(response);

      if (!response.ok) {
        result.apiFootball.message = `API-Football respondió ${response.status}.`;
      } else if (!payload?.response?.length) {
        result.apiFootball.message = 'API-Football respondió, pero sin datos.';
      } else {
        result.apiFootball.ok = true;
        result.apiFootball.message = 'Conexión OK con API-Football.';
      }
    } catch (error) {
      result.apiFootball.message = error instanceof Error ? error.message : 'Error desconocido en API-Football.';
    }
  }

  if (!result.oddsApi.configured) {
    result.oddsApi.message = 'Falta ODDS_API_KEY.';
  } else {
    try {
      const availableSportKeys = await fetchAvailableSportKeys();
      const sportKey = result.oddsApi.sportKey;
      const matched = sportKey ? availableSportKeys.has(sportKey) : false;
      result.oddsApi.ok = true;
      result.oddsApi.sportKeyAvailable = sportKey ? matched : undefined;
      result.oddsApi.message = sportKey
        ? matched
          ? `Conexión OK con The Odds API y sport key ${sportKey} disponible.`
          : `Conexión OK con The Odds API, pero el sport key ${sportKey} no aparece disponible ahora mismo.`
        : 'Conexión OK con The Odds API, pero esta liga no tiene sport key configurado.';
    } catch (error) {
      result.oddsApi.message = error instanceof Error ? error.message : 'Error desconocido en The Odds API.';
    }
  }

  return result;
}

export async function checkLeagueStatuses(): Promise<LeagueStatusResult> {
  const checkedAt = new Date().toISOString();

  if (!process.env.ODDS_API_KEY) {
    return {
      checkedAt,
      oddsApiConfigured: false,
      leagueStatuses: LEAGUE_OPTIONS.map((league) => ({
        leagueKey: league.key,
        label: league.label,
        sportKey: league.oddsSportKey,
        status: league.oddsSportKey ? 'unchecked' : 'missing_sport_key',
        message: league.oddsSportKey
          ? 'Falta ODDS_API_KEY para validar si esta liga tiene cuotas reales.'
          : 'Esta liga no tiene sport key configurado dentro de la app.',
      })),
    };
  }

  const availableSportKeys = await fetchAvailableSportKeys();

  return {
    checkedAt,
    oddsApiConfigured: true,
    leagueStatuses: LEAGUE_OPTIONS.map((league) => {
      if (!league.oddsSportKey) {
        return {
          leagueKey: league.key,
          label: league.label,
          sportKey: undefined,
          status: 'missing_sport_key' as const,
          message: 'Esta liga no tiene sport key configurado dentro de la app.',
        };
      }

      const available = availableSportKeys.has(league.oddsSportKey);
      return {
        leagueKey: league.key,
        label: league.label,
        sportKey: league.oddsSportKey,
        status: available ? 'ok' as const : 'unavailable' as const,
        message: available
          ? `Sport key ${league.oddsSportKey} disponible ahora mismo en The Odds API.`
          : `Sport key ${league.oddsSportKey} no aparece disponible ahora mismo en The Odds API.`,
      };
    }),
  };
}

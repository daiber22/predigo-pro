'use client';

import { useEffect, useMemo, useState } from 'react';
import { BOOKMAKER_OPTIONS, MARKET_OPTIONS } from '@/lib/odds-options';
import { LEAGUE_OPTIONS, getLeagueOption } from '@/lib/league-options';
import { buildAutomaticTicket, pickForAnalysis } from '@/lib/ticket';
import { AnalysisResult, FixtureMatch, OddsMarketKey, OddsResponse, TeamStatsInput, TicketItem, TicketProfile } from '@/lib/types';

type SearchFormState = {
  homeTeam: string;
  awayTeam: string;
  leagueKey: string;
  league: string;
  country: string;
  season: string;
  matchDate: string;
};

type OddsControlState = {
  bookmakerKey: string;
  comparisonMarkets: OddsMarketKey[];
};

type ConnectionStatus = {
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

type LeagueQuotaStatus = {
  leagueKey: string;
  label: string;
  sportKey?: string;
  status: 'ok' | 'missing_sport_key' | 'unavailable' | 'unchecked';
  message: string;
};

type LeagueStatusSnapshot = {
  checkedAt: string;
  oddsApiConfigured: boolean;
  leagueStatuses: LeagueQuotaStatus[];
};
type LeagueSearchResult = {
  leagueId: number | null;
  leagueKey: string;
  league: string;
  country: string;
  season: number;
  logo: string | null;
  flag: string | null;
  oddsSportKey: string | null;
  status: 'mapped' | 'missing_sport_key';
  source: 'api-football' | 'demo';
  searchLabel: string;
};
const defaultLeague = getLeagueOption('colombia-primera-a') || LEAGUE_OPTIONS[0];

const defaultForm: SearchFormState = {
  homeTeam: 'Junior',
  awayTeam: 'Once Caldas',
  leagueKey: defaultLeague.key,
  league: defaultLeague.league,
  country: defaultLeague.country,
  season: String(defaultLeague.defaultSeason),
  matchDate: '',
};

const defaultOddsControls: OddsControlState = {
  bookmakerKey: 'auto',
  comparisonMarkets: ['1x2', 'totals', 'btts', 'double_chance'],
};

const ticketStorageKey = 'predigol-ticket';
const historyStorageKey = 'predigol-history';
const connectionStorageKey = 'predigol-connections';
const leagueStatusStorageKey = 'predigol-league-statuses';

function getStatusIcon(status?: LeagueQuotaStatus['status']) {
  if (status === 'ok') return '🟢';
  if (status === 'missing_sport_key' || status === 'unavailable') return '🔴';
  return '⚪';
}

function getStatusLabel(status?: LeagueQuotaStatus['status']) {
  if (status === 'ok') return 'Cuotas reales listas';
  if (status === 'missing_sport_key') return 'Sin sport key';
  if (status === 'unavailable') return 'No disponible hoy';
  return 'Sin validar';
}

function getStatusTone(status?: LeagueQuotaStatus['status']) {
  if (status === 'ok') return 'ok';
  if (status === 'missing_sport_key' || status === 'unavailable') return 'bad';
  return 'neutral';
}

function formatCheckedAt(value?: string) {
  if (!value) return 'Sin validar todavía';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CO');
}

export function PredigolApp() {
  const [form, setForm] = useState<SearchFormState>(defaultForm);
  const [fixture, setFixture] = useState<FixtureMatch | null>(null);
  const [odds, setOdds] = useState<OddsResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [ticket, setTicket] = useState<TicketItem[]>([]);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [loading, setLoading] = useState<'fixture' | 'analysis' | 'odds' | 'connections' | 'league-status' | null>(null);
  const [message, setMessage] = useState<string>('');
  const [oddsControls, setOddsControls] = useState<OddsControlState>(defaultOddsControls);
  const [ticketMaxPicks, setTicketMaxPicks] = useState<string>('4');
  const [lastGeneratedProfile, setLastGeneratedProfile] = useState<TicketProfile | null>(null);
  const [connections, setConnections] = useState<ConnectionStatus | null>(null);
  const [leagueSnapshot, setLeagueSnapshot] = useState<LeagueStatusSnapshot | null>(null);
const [leagueSearch, setLeagueSearch] = useState<string>('');
const [leagueResults, setLeagueResults] = useState<LeagueSearchResult[]>([]);
const [leagueSearchLoading, setLeagueSearchLoading] = useState(false);
const [selectedSearchLeague, setSelectedSearchLeague] = useState<LeagueSearchResult | null>(null);
  const selectedLeague = getLeagueOption(form.leagueKey);
  const selectedBookmaker = BOOKMAKER_OPTIONS.find((item) => item.value === oddsControls.bookmakerKey) || BOOKMAKER_OPTIONS[0];


  useEffect(() => {
    const savedTicket = window.localStorage.getItem(ticketStorageKey);
    const savedHistory = window.localStorage.getItem(historyStorageKey);
    const savedConnections = window.localStorage.getItem(connectionStorageKey);
    const savedLeagueStatuses = window.localStorage.getItem(leagueStatusStorageKey);

    if (savedTicket) setTicket(JSON.parse(savedTicket));
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    if (savedConnections) setConnections(JSON.parse(savedConnections));
    if (savedLeagueStatuses) setLeagueSnapshot(JSON.parse(savedLeagueStatuses));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ticketStorageKey, JSON.stringify(ticket));
  }, [ticket]);

  useEffect(() => {
    window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (connections) {
      window.localStorage.setItem(connectionStorageKey, JSON.stringify(connections));
    }
  }, [connections]);

  useEffect(() => {
    if (leagueSnapshot) {
      window.localStorage.setItem(leagueStatusStorageKey, JSON.stringify(leagueSnapshot));
    }
  }, [leagueSnapshot]);

  const totalTicketOdd = useMemo(() => ticket.reduce((acc: number, item: TicketItem) => acc * item.odd, 1), [ticket]);

  const confidenceSummary = useMemo(() => {
    if (!ticket.length) return 'Sin ticket';
    const high = ticket.filter((item: TicketItem) => item.confidence === 'Alta').length;
    if (high >= Math.ceil(ticket.length / 2)) return 'Alta';
    const medium = ticket.filter((item: TicketItem) => item.confidence === 'Media').length;
    return high + medium >= Math.ceil(ticket.length / 2) ? 'Media' : 'Baja';
  }, [ticket]);

  const filteredComparisons = useMemo(() => {
    if (!analysis?.comparisons?.length) return [];
    return analysis.comparisons.filter((row) => oddsControls.comparisonMarkets.includes(row.marketKey));
  }, [analysis, oddsControls.comparisonMarkets]);

  const ticketSourceAnalyses = useMemo(() => {
    const current = analysis ? [analysis] : [];
    return [...current, ...history];
  }, [analysis, history]);

  const canAnalyze = Boolean(fixture?.stats);

  const leagueStatusMap = useMemo(() => {
    return Object.fromEntries((leagueSnapshot?.leagueStatuses || []).map((item) => [item.leagueKey, item])) as Record<string, LeagueQuotaStatus>;
  }, [leagueSnapshot]);
  const quickLeagueOptions = useMemo(() => {
  const baseOptions = LEAGUE_OPTIONS.map((item) => {
    const status =
      leagueStatusMap[item.key]?.status || (!item.oddsSportKey ? 'missing_sport_key' : 'unchecked');

    return {
      value: item.key,
      label: `${getStatusIcon(status)} ${item.label}`,
    };
  });

  if (selectedSearchLeague) {
    const exists = baseOptions.some((item) => item.value === selectedSearchLeague.leagueKey);

    if (!exists) {
      return [
        {
          value: selectedSearchLeague.leagueKey,
          label: `🔎 ${selectedSearchLeague.searchLabel}`,
        },
        ...baseOptions,
      ];
    }
  }

  return baseOptions;
}, [leagueStatusMap, selectedSearchLeague]);

  const validatedLeagueCount = useMemo(() => {
    return leagueSnapshot?.leagueStatuses.filter((item) => item.status === 'ok').length || 0;
  }, [leagueSnapshot]);

  const currentLeagueStatus = useMemo(() => {
  if (selectedLeague) {
    return leagueStatusMap[selectedLeague.key] || (!selectedLeague.oddsSportKey
      ? {
          leagueKey: selectedLeague.key,
          label: selectedLeague.label,
          sportKey: undefined,
          status: 'missing_sport_key' as const,
          message: 'Esta liga no tiene sport key configurado dentro de la app.',
        }
      : undefined);
  }

  if (selectedSearchLeague) {
    return {
      leagueKey: selectedSearchLeague.leagueKey,
      label: selectedSearchLeague.searchLabel,
      sportKey: selectedSearchLeague.oddsSportKey || undefined,
      status: selectedSearchLeague.oddsSportKey ? 'unchecked' as const : 'missing_sport_key' as const,
      message: selectedSearchLeague.oddsSportKey
        ? 'Liga encontrada desde la API. Ya puedes buscar partido y luego probar cuotas.'
        : 'Liga encontrada desde la API, pero todavía no tiene sport key mapeado dentro de la app.',
    };
  }

  return undefined;
}, [leagueStatusMap, selectedLeague, selectedSearchLeague]);

 function applyLeagueKey(leagueKey: string) {
  const option = getLeagueOption(leagueKey);
  setSelectedSearchLeague(null);
  setLeagueResults([]);
  setLeagueSearch('');
  setForm((current: SearchFormState) => ({
    ...current,
    leagueKey,
    league: option?.league || current.league,
    country: option?.country || current.country,
    season: option?.defaultSeason ? String(option.defaultSeason) : current.season,
  }));
}
async function handleSearchLeagues() {
  const query = leagueSearch.trim();

  if (!query) {
    setLeagueResults([]);
    setMessage('Escribe una liga o un país para buscar.');
    return;
  }

  setLeagueSearchLoading(true);
  setMessage('');

  try {
    const response = await fetch(
      `/api/ligas?search=${encodeURIComponent(query)}&season=${encodeURIComponent(
        form.season || String(new Date().getFullYear()),
      )}`,
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'No se pudieron buscar ligas.');
    }

    setLeagueResults(payload.results || []);
    setMessage(
      payload.results?.length
        ? `Encontré ${payload.results.length} resultado${payload.results.length === 1 ? '' : 's'} para "${query}".`
        : `No encontré ligas para "${query}".`,
    );
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'No se pudieron buscar ligas.');
  } finally {
    setLeagueSearchLoading(false);
  }
}
  function applyLeagueSearchResult(result: LeagueSearchResult) {
  setSelectedSearchLeague(result);
  setForm((current: SearchFormState) => ({
    ...current,
    leagueKey: result.leagueKey,
    league: result.league,
    country: result.country,
    season: String(result.season),
  }));
  setFixture(null);
  setOdds(null);
  setAnalysis(null);
  setLeagueSearch(result.searchLabel);
  setLeagueResults([]);
  setMessage(
    result.oddsSportKey
      ? `Liga seleccionada: ${result.searchLabel}. Quedó enlazada con cuotas por sport key.`
      : `Liga seleccionada: ${result.searchLabel}. La app puede buscar el partido, pero esa liga todavía no tiene sport key mapeado.`,
  );
}
  function toggleMarketFilter(market: OddsMarketKey) {
    setOddsControls((current) => {
      const exists = current.comparisonMarkets.includes(market);
      const nextMarkets = exists
        ? current.comparisonMarkets.filter((item) => item !== market)
        : [...current.comparisonMarkets, market];

      return {
        ...current,
        comparisonMarkets: nextMarkets.length ? nextMarkets : ['1x2'],
      };
    });
  }

  async function handleValidateLeagues(showSuccessMessage = true) {
    setLoading('league-status');
    try {
      const response = await fetch('/api/league-status', {
        method: 'GET',
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo validar el mapa de ligas.');
      }

      setLeagueSnapshot(payload);
      if (showSuccessMessage) {
        const okCount = payload.leagueStatuses?.filter((item: LeagueQuotaStatus) => item.status === 'ok').length || 0;
        setMessage(`Mapa de ligas actualizado. ${okCount} liga${okCount === 1 ? '' : 's'} con cuotas reales disponibles ahora mismo.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo validar el mapa de ligas.');
    } finally {
      setLoading(null);
    }
  }

  async function handleTestConnections() {
    setLoading('connections');
    setMessage('');
    try {
      const response = await fetch('/api/test-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueKey: form.leagueKey }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'No se pudieron probar las conexiones.');
      }

      setConnections(payload.connections);
      await handleValidateLeagues(false);

      const apiOk = payload.connections?.apiFootball?.ok;
      const oddsOk = payload.connections?.oddsApi?.ok;
      setMessage(apiOk && oddsOk ? 'Conexiones probadas. Las dos APIs respondieron y el mapa de ligas quedó actualizado.' : 'Conexiones probadas. Revisa el estado y el mapa de ligas antes de analizar.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron probar las conexiones.');
    } finally {
      setLoading(null);
    }
  }

  async function handleSearchFixture() {
    setLoading('fixture');
    setMessage('');
    try {
      const response = await fetch('/api/search-fixture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeTeam: form.homeTeam,
          awayTeam: form.awayTeam,
          leagueKey: form.leagueKey,
          league: form.league,
          country: form.country,
          season: Number(form.season),
          matchDate: form.matchDate,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo buscar el partido.');
      }

      setFixture(payload.fixture);
      setOdds(null);
      setAnalysis(null);
      setMessage(
        payload.fixture?.source === 'mock'
          ? 'Se usó demo fallback porque la app no pudo resolver ese cruce de forma real.'
          : 'Partido encontrado y estadísticas cargadas automáticamente.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pude encontrar el partido. Revisa nombres o usa el modo demo.');
    } finally {
      setLoading(null);
    }
  }
async function handleLoadExample() {
  const exampleForm = defaultForm;
  setForm(exampleForm);
  setLoading('fixture');
  setMessage('');

  try {
    const response = await fetch('/api/search-fixture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        homeTeam: exampleForm.homeTeam,
        awayTeam: exampleForm.awayTeam,
        leagueKey: exampleForm.leagueKey,
        league: exampleForm.league,
        country: exampleForm.country,
        season: Number(exampleForm.season),
        matchDate: exampleForm.matchDate,
      }),
    });

    const payload = await response.json();
if (!response.ok) {
  throw new Error(payload.error || 'No se pudo cargar el ejemplo.');
}

setFixture(payload.fixture);
setOdds(null);
setAnalysis(null);
setMessage(
  payload.fixture?.source === 'mock'
    ? 'Ejemplo cargado con demo fallback.'
    : 'Ejemplo cargado y estadísticas listas.'
);
    if (!response.ok) {
      throw new Error(payload.error || 'No se pudo cargar el ejemplo.');
    }

    setFixture(payload.fixture);
    setOdds(null);
    setAnalysis(null);
    setMessage(
      payload.fixture?.source === 'mock'
        ? 'Ejemplo cargado con demo fallback.'
        : 'Ejemplo cargado y estadísticas listas.'
    );
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'No se pudo cargar el ejemplo.');
  } finally {
    setLoading(null);
  }
}
  async function handleAnalyze() {
    if (!fixture) return;
    setLoading('analysis');
    setMessage('');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixture, odds }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'No se pudo calcular el análisis.');
      }

      setAnalysis(payload.analysis);
      setHistory((current: AnalysisResult[]) => [payload.analysis, ...current].slice(0, 30));
      setMessage('Análisis generado con el modelo Poisson corregido.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pude calcular el análisis.');
    } finally {
      setLoading(null);
    }
  }

  async function handleLoadOdds() {
    if (!fixture) return;
    setLoading('odds');
    setMessage('');
    try {
      const response = await fetch('/api/odds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixture,
          bookmakerKey: oddsControls.bookmakerKey === 'auto' ? undefined : oddsControls.bookmakerKey,
          comparisonMarkets: oddsControls.comparisonMarkets,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'No se pudieron cargar las cuotas.');
      }

      setOdds(payload.odds);

      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixture, odds: payload.odds }),
      });
      const analyzePayload = await analyzeResponse.json();
      if (!analyzeResponse.ok) {
        throw new Error(analyzePayload.error || 'No se pudo recalcular el análisis con cuotas.');
      }

      setAnalysis(analyzePayload.analysis);
      setHistory((current: AnalysisResult[]) => [analyzePayload.analysis, ...current].slice(0, 30));

      const currentLeague = getLeagueOption(fixture.leagueKey);
      const fallbackReason = !fixture.oddsSportKey && currentLeague
        ? `Cuotas en demo fallback: ${currentLeague.label} no tiene sport key configurado dentro de la app.`
        : 'Cuotas cargadas en demo fallback porque faltó coincidencia exacta o la app está configurada para permitirlo.';

      setMessage(
        payload.odds?.source === 'mock'
          ? fallbackReason
          : `Cuotas cargadas desde ${payload.odds?.bookmaker || 'la API'} con filtros de mercado aplicados.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pude cargar las cuotas.');
    } finally {
      setLoading(null);
    }
  }

  function updateStats(patch: Partial<TeamStatsInput>) {
    if (!fixture) return;
    setFixture({
      ...fixture,
      stats: {
        ...fixture.stats,
        ...patch,
      },
    });
    setAnalysis(null);
  }

  function addProfilePick(profile: TicketProfile) {
    if (!analysis) return;
    const item = pickForAnalysis(analysis, {
      profile,
      allowedMarkets: oddsControls.comparisonMarkets,
    });

    if (!item) {
      setMessage('No encontré un pick válido para ese perfil con los mercados activos.');
      return;
    }

    setTicket((current: TicketItem[]) => [
      {
        ...item,
        bookmaker: odds?.bookmaker,
      },
      ...current,
    ]);
    setLastGeneratedProfile(profile);
    setMessage(`Pick ${profile} agregado al ticket usando el análisis actual.`);
  }

  function generateAutoTicket(profile: TicketProfile) {
    const maxPicks = Math.max(1, Number(ticketMaxPicks) || 4);
    const generated = buildAutomaticTicket(ticketSourceAnalyses, {
      profile,
      maxPicks,
      allowedMarkets: oddsControls.comparisonMarkets,
    });

    if (!generated.length) {
      setMessage('Necesitas varios análisis con cuotas para generar un ticket automático con ese perfil.');
      return;
    }

    setTicket(generated);
    setLastGeneratedProfile(profile);
    setMessage(`Ticket ${profile} generado con ${generated.length} pick${generated.length === 1 ? '' : 's'} automáticos.`);
  }

  function removeTicketItem(id: string) {
    setTicket((current: TicketItem[]) => current.filter((item: TicketItem) => item.id !== id));
  }

  function clearTicket() {
    setTicket([]);
    setLastGeneratedProfile(null);
    setMessage('Ticket limpiado.');
  }

  return (
    <div className="app-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">PrediGol Pro v8</p>
          <h1>Estado de conexión guardado y ligas marcadas según cuotas reales</h1>
          <p className="hero-copy">
            Ahora la app recuerda el último estado de conexión, valida de una sola vez las ligas cargadas dentro del proyecto
            y marca en rojo las que no tienen sport key real o que hoy no aparecen disponibles en The Odds API.
          </p>
        </div>
        <div className="hero-meta">
          <span>Modo: {fixture?.source === 'api-football' ? 'API real' : 'Demo / mock'}</span>
          <span>Liga activa: {selectedLeague?.label || form.league}</span>
          <span>Bookmaker: {selectedBookmaker.label}</span>
          <span>Ticket actual: {ticket.length} picks</span>
          <span>Ligas validadas OK: {validatedLeagueCount}</span>
        </div>
      </section>

      <div className="grid two-columns">
        <section className="panel">
          <header className="panel-header">
            <div>
              <p className="section-kicker">1. Partidos</p>
              <h2>Buscar partido</h2>
            </div>
          </header>
<div className="fixture-card">
  <div className="panel-header">
    <div>
      <p className="section-kicker">Buscar cualquier liga</p>
      <h3>Ligas desde API</h3>
    </div>
    <span className="pill">Resultados: {leagueResults.length}</span>
  </div>

  <div className="form-grid">
    <Input
      label="Buscar liga o país"
      value={leagueSearch}
      onChange={setLeagueSearch}
    />
  </div>

  <div className="actions-row">
    <button
      className="secondary"
      onClick={handleSearchLeagues}
      disabled={leagueSearchLoading}
    >
      {leagueSearchLoading ? 'Buscando ligas...' : 'Buscar liga en API'}
    </button>
  </div>

  {leagueResults.length ? (
    <div className="league-status-grid">
      {leagueResults.map((result) => {
        const tone = result.oddsSportKey ? 'ok' : 'bad';
        const active =
          form.leagueKey === result.leagueKey &&
          form.league === result.league &&
          form.country === result.country;

        return (
          <button
            key={`${result.leagueKey}-${result.leagueId ?? result.searchLabel}-${result.season}`}
            type="button"
            className={`league-status-card tone-${tone} ${active ? 'active' : ''}`}
            onClick={() => applyLeagueSearchResult(result)}
          >
            <div className="league-status-top">
              <strong>{result.searchLabel}</strong>
              <span className={`status-badge tone-${tone}`}>
                {result.oddsSportKey ? 'Sport key OK' : 'Sin sport key'}
              </span>
            </div>
            <small>{result.oddsSportKey || 'No configurado en app'}</small>
            <p>Temporada {result.season} · Fuente {result.source}</p>
          </button>
        );
      })}
    </div>
  ) : (
    <p className="helper-text">
      Escribe una liga o un país y luego pulsa “Buscar liga en API”.
    </p>
  )}
</div>
          <div className="form-grid">
            <SelectField
              label="Liga rápida (opcional)"
              value={form.leagueKey}
              onChange={applyLeagueKey}
            options={quickLeagueOptions}
            />
            <Input label="Temporada" value={form.season} onChange={(value) => setForm({ ...form, season: value })} />
            <Input label="Equipo local" value={form.homeTeam} onChange={(value) => setForm({ ...form, homeTeam: value })} />
            <Input label="Equipo visitante" value={form.awayTeam} onChange={(value) => setForm({ ...form, awayTeam: value })} />
            <Input label="Liga" value={form.league} onChange={(value) => setForm({ ...form, league: value })} />
            <Input label="País" value={form.country} onChange={(value) => setForm({ ...form, country: value })} />
            <Input label="Fecha" type="date" value={form.matchDate} onChange={(value) => setForm({ ...form, matchDate: value })} />
          </div>

          <div className={`quick-league-note status-${getStatusTone(currentLeagueStatus?.status)}`}>
            <span>Sport key cuotas:</span>
            <strong>{selectedLeague?.oddsSportKey || 'No configurado en app / usa demo'}</strong>
            <span className="status-inline">{getStatusIcon(currentLeagueStatus?.status)} {getStatusLabel(currentLeagueStatus?.status)}</span>
          </div>

          <div className="actions-row">
            <button className="primary" onClick={handleSearchFixture} disabled={loading === 'fixture'}>
              {loading === 'fixture' ? 'Buscando...' : 'Buscar partido'}
            </button>
            <button className="secondary" onClick={handleTestConnections} disabled={loading === 'connections' || loading === 'league-status'}>
              {loading === 'connections' ? 'Probando...' : 'Probar conexión API'}
            </button>
            <button className="secondary" onClick={() => handleValidateLeagues(true)} disabled={loading === 'league-status' || loading === 'connections'}>
              {loading === 'league-status' ? 'Validando ligas...' : 'Validar ligas cuotas'}
            </button>
           <button className="secondary" onClick={handleLoadExample}>
  Cargar ejemplo
</button>
          </div>

          {connections && (
            <div className="fixture-card">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Estado API</p>
                  <h3>Conexiones activas</h3>
                </div>
                <span className="pill">Demo fallback: {connections.demoFallback ? 'Activo' : 'Apagado'}</span>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <h3>API-Football</h3>
                  <p><strong>Configurada:</strong> {connections.apiFootball.configured ? 'Sí' : 'No'}</p>
                  <p><strong>Estado:</strong> {connections.apiFootball.ok ? 'OK' : 'Revisar'}</p>
                  <p>{connections.apiFootball.message}</p>
                </div>

                <div className="stat-card">
                  <h3>The Odds API</h3>
                  <p><strong>Configurada:</strong> {connections.oddsApi.configured ? 'Sí' : 'No'}</p>
                  <p><strong>Estado:</strong> {connections.oddsApi.ok ? 'OK' : 'Revisar'}</p>
                  <p><strong>Sport key:</strong> {connections.oddsApi.sportKey || 'No configurado'}</p>
                  <p><strong>Disponible ahora:</strong> {connections.oddsApi.sportKeyAvailable === undefined ? 'Sin validar' : connections.oddsApi.sportKeyAvailable ? 'Sí' : 'No'}</p>
                  <p>{connections.oddsApi.message}</p>
                </div>
              </div>
            </div>
          )}

          <div className="fixture-card league-map-card">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Mapa de ligas</p>
                <h3>Cuotas reales por liga</h3>
              </div>
              <span className="pill">Última validación: {formatCheckedAt(leagueSnapshot?.checkedAt)}</span>
            </div>

            <div className="league-status-grid">
              {LEAGUE_OPTIONS.map((item) => {
                const status = leagueStatusMap[item.key] || (!item.oddsSportKey
                  ? {
                      leagueKey: item.key,
                      label: item.label,
                      sportKey: undefined,
                      status: 'missing_sport_key' as const,
                      message: 'Esta liga no tiene sport key configurado dentro de la app.',
                    }
                  : {
                      leagueKey: item.key,
                      label: item.label,
                      sportKey: item.oddsSportKey,
                      status: 'unchecked' as const,
                      message: 'Todavía no validaste esta liga contra The Odds API.',
                    });
                const active = item.key === form.leagueKey;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`league-status-card tone-${getStatusTone(status.status)} ${active ? 'active' : ''}`}
                    onClick={() => applyLeagueKey(item.key)}
                  >
                    <div className="league-status-top">
                      <strong>{getStatusIcon(status.status)} {item.label}</strong>
                      <span className={`status-badge tone-${getStatusTone(status.status)}`}>{getStatusLabel(status.status)}</span>
                    </div>
                    <small>{status.sportKey || 'Sin sport key en app'}</small>
                    <p>{status.message}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {fixture && (
            <div className="fixture-card">
              <div>
                <strong>
                  {fixture.stats.homeTeam} vs {fixture.stats.awayTeam}
                </strong>
                <p>
                  {fixture.leagueName} · {fixture.round || 'Sin ronda'} · {fixture.matchDate || 'Fecha por definir'}
                </p>
              </div>
              <div className="pill-row">
                <span className="pill">{fixture.country || 'País'}</span>
                <span className="pill">Temporada {fixture.season || '-'}</span>
                <span className="pill">ID {fixture.fixtureId}</span>
              </div>
            </div>
          )}

          {message ? <p className="helper-text">{message}</p> : null}
        </section>

        <section className="panel">
          <header className="panel-header">
            <div>
              <p className="section-kicker">2. Estadísticas</p>
              <h2>Datos automáticos editables</h2>
            </div>
          </header>

          {fixture ? (
            <div className="stats-grid">
              <StatEditor title={fixture.stats.homeTeam} side="home" stats={fixture.stats} onUpdate={updateStats} />
              <StatEditor title={fixture.stats.awayTeam} side="away" stats={fixture.stats} onUpdate={updateStats} />
            </div>
          ) : (
            <EmptyState text={message || 'Primero busca un partido para cargar estadísticas.'} />
          )}

          <div className="actions-row">
            <button className="primary" onClick={handleAnalyze} disabled={!canAnalyze || loading === 'analysis'}>
              {loading === 'analysis' ? 'Analizando...' : 'Analizar partido'}
            </button>
            <button className="secondary" onClick={handleLoadOdds} disabled={!fixture || loading === 'odds'}>
              {loading === 'odds' ? 'Cargando cuotas...' : 'Traer cuotas'}
            </button>
          </div>
        </section>
      </div>

      <div className="grid two-columns">
        <section className="panel">
          <header className="panel-header">
            <div>
              <p className="section-kicker">3. Análisis</p>
              <h2>Salida del modelo</h2>
            </div>
            <div className="actions-row compact-actions-row">
              <button className="secondary" onClick={() => addProfilePick('conservador')} disabled={!analysis}>
                Agregar actual conservador
              </button>
              <button className="secondary" onClick={() => addProfilePick('medio')} disabled={!analysis}>
                Agregar actual medio
              </button>
              <button className="secondary" onClick={() => addProfilePick('agresivo')} disabled={!analysis}>
                Agregar actual agresivo
              </button>
            </div>
          </header>

          {analysis ? (
            <>
              <div className="metric-grid">
                <MetricCard label="Local" value={`${Math.round(analysis.p1 * 100)}%`} helper="Probabilidad 1" />
                <MetricCard label="Empate" value={`${Math.round(analysis.px * 100)}%`} helper="Probabilidad X" />
                <MetricCard label="Visitante" value={`${Math.round(analysis.p2 * 100)}%`} helper="Probabilidad 2" />
                <MetricCard label="Under 3.5" value={`${Math.round(analysis.under35 * 100)}%`} helper="Línea fuerte" />
              </div>

              <div className="analysis-columns">
                <div>
                  <h3>Recomendaciones</h3>
                  <ul className="clean-list">
                    <li><strong>Principal:</strong> {analysis.recommendation.mainPick}</li>
                    <li><strong>Conservador:</strong> {analysis.recommendation.conservativePick}</li>
                    <li><strong>Agresivo:</strong> {analysis.recommendation.aggressivePick}</li>
                    <li><strong>Confianza:</strong> {analysis.confidence}</li>
                  </ul>
                </div>
                <div>
                  <h3>Marcadores probables</h3>
                  <ul className="clean-list compact">
                    {analysis.scorelines.map((item) => (
                      <li key={item.score}>
                        <span>{item.score}</span>
                        <strong>{Math.round(item.probability * 100)}%</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <EmptyState text="Cuando ejecutes el análisis, aquí saldrán probabilidades, mercado base y top de marcadores." />
          )}
        </section>

        <section className="panel">
          <header className="panel-header odds-header-stack">
            <div>
              <p className="section-kicker">4. Cuotas</p>
              <h2>Comparación modelo vs cuota</h2>
            </div>
          </header>

          <div className="form-grid compact-form-grid">
            <SelectField
              label="Casa de apuestas"
              value={oddsControls.bookmakerKey}
              onChange={(value) => setOddsControls({ ...oddsControls, bookmakerKey: value })}
              options={BOOKMAKER_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
            />
          </div>

          <div className="market-chip-wrap">
            {MARKET_OPTIONS.map((option) => {
              const active = oddsControls.comparisonMarkets.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`chip ${active ? 'active' : ''}`}
                  onClick={() => toggleMarketFilter(option.value)}
                >
                  <span>{option.label}</span>
                  <small>{option.helper}</small>
                </button>
              );
            })}
          </div>

          <p className="helper-text odds-subnote">
            Bookmaker elegido: <strong>{selectedBookmaker.label}</strong>. Los picks del ticket usarán primero los mercados filtrados arriba.
          </p>

          {filteredComparisons.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mercado</th>
                    <th>Selección</th>
                    <th>Cuota</th>
                    <th>Implícita</th>
                    <th>Modelo</th>
                    <th>Edge</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComparisons.map((row) => (
                    <tr key={`${row.market}-${row.selection}`}>
                      <td>{row.market}</td>
                      <td>{row.selection}</td>
                      <td>{row.odd.toFixed(2)}</td>
                      <td>{Math.round(row.impliedProbability * 100)}%</td>
                      <td>{Math.round(row.modelProbability * 100)}%</td>
                      <td>
                        <span className={`signal ${row.signal}`}>{(row.edge * 100).toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : analysis?.comparisons.length ? (
            <EmptyState text="Tu filtro de mercados dejó la tabla vacía. Activa al menos un mercado con cuotas disponibles." />
          ) : (
            <EmptyState text="Carga cuotas para ver valor esperado, probabilidad implícita y semáforo." />
          )}
        </section>
      </div>

      <div className="grid two-columns">
        <section className="panel">
          <header className="panel-header">
            <div>
              <p className="section-kicker">5. Ticket</p>
              <h2>Generador de ticket</h2>
            </div>
          </header>

          <div className="ticket-builder-card">
            <div className="ticket-builder-top">
              <label className="field max-picks-field">
                <span>Máximo de picks</span>
                <select value={ticketMaxPicks} onChange={(event: { target: { value: string } }) => setTicketMaxPicks(event.target.value)}>
                  {['2', '3', '4', '5', '6', '8'].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <div className="profile-button-row">
                <button className="primary" onClick={() => generateAutoTicket('conservador')}>
                  Generar conservador
                </button>
                <button className="secondary" onClick={() => generateAutoTicket('medio')}>
                  Generar medio
                </button>
                <button className="secondary" onClick={() => generateAutoTicket('agresivo')}>
                  Generar agresivo
                </button>
                <button className="ghost" onClick={clearTicket} disabled={!ticket.length}>
                  Limpiar
                </button>
              </div>
            </div>
            <p className="helper-text ticket-helper-text">
              Toma los análisis recientes con cuotas, respeta los mercados activos y elige un pick por partido según el perfil de riesgo.
            </p>
          </div>

          <div className="ticket-summary">
            <MetricCard label="Picks" value={String(ticket.length)} helper="Elementos en ticket" />
            <MetricCard label="Cuota total" value={ticket.length ? totalTicketOdd.toFixed(2) : '0.00'} helper="Multiplicada" />
            <MetricCard label="Confianza" value={confidenceSummary} helper="Resumen" />
            <MetricCard label="Perfil" value={lastGeneratedProfile || 'Manual'} helper="Selección" />
          </div>

          {ticket.length ? (
            <ul className="ticket-list">
              {ticket.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>
                      {item.homeTeam} vs {item.awayTeam}
                    </strong>
                    <p>
                      {item.market ? `${item.market} · ` : ''}{item.pick} · Cuota {item.odd.toFixed(2)} · {item.confidence}
                    </p>
                    <div className="ticket-meta-line">
                      {item.profile ? <span className="pill small-pill">{item.profile}</span> : null}
                      {item.edge !== undefined ? <span className="muted">Edge {(item.edge * 100).toFixed(1)}%</span> : null}
                    </div>
                    {item.rationale ? <small className="muted">{item.rationale}</small> : null}
                    {item.bookmaker ? <small className="muted block">Bookmaker: {item.bookmaker}</small> : null}
                  </div>
                  <button className="ghost" onClick={() => removeTicketItem(item.id)}>
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Todavía no agregas picks al ticket." />
          )}
        </section>

        <section className="panel">
          <header className="panel-header">
            <div>
              <p className="section-kicker">6. Historial</p>
              <h2>Últimos análisis</h2>
            </div>
          </header>

          {history.length ? (
            <ul className="history-list">
              {history.slice(0, 8).map((item, index) => (
                <li key={`${item.homeTeam}-${item.awayTeam}-${index}`}>
                  <div>
                    <strong>
                      {item.homeTeam} vs {item.awayTeam}
                    </strong>
                    <p>
                      {item.recommendation.mainPick} · {item.confidence} · {item.poissonTop1}
                    </p>
                  </div>
                  <span className="pill">{item.totalLambda}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState text="Aquí se guardan los análisis recientes en el navegador." />
          )}
        </section>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event: { target: { value: string } }) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event: { target: { value: string } }) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatEditor({
  title,
  side,
  stats,
  onUpdate,
}: {
  title: string;
  side: 'home' | 'away';
  stats: TeamStatsInput;
  onUpdate: (patch: Partial<TeamStatsInput>) => void;
}) {
  const prefix = side === 'home' ? 'home' : 'away';
 const labels = side === 'home'
  ? [
      ['homeGoalsForGeneral', 'GF general'],
      ['homeGoalsAgainstGeneral', 'GC general'],
      ['homeGoalsForHome', 'GF local'],
      ['homeGoalsAgainstHome', 'GC local'],
      ['homeShotsOnTargetGeneral', 'Remates a puerta general'],
      ['homeBlockedShotsGeneral', 'Remates bloqueados general'],
      ['homeShotsOnTargetHome', 'Remates a puerta local'],
      ['homeBlockedShotsHome', 'Remates bloqueados local'],
    ]
  : [
      ['awayGoalsForGeneral', 'GF general'],
      ['awayGoalsAgainstGeneral', 'GC general'],
      ['awayGoalsForAway', 'GF visita'],
      ['awayGoalsAgainstAway', 'GC visita'],
      ['awayShotsOnTargetGeneral', 'Remates a puerta general'],
      ['awayBlockedShotsGeneral', 'Remates bloqueados general'],
      ['awayShotsOnTargetAway', 'Remates a puerta visita'],
      ['awayBlockedShotsAway', 'Remates bloqueados visita'],
    ];
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <div className="mini-grid">
        {labels.map(([key, label]) => (
          <label className="field" key={key}>
            <span>{label}</span>
            <input
              type="number"
              step="0.01"
              value={String((stats as unknown as Record<string, number>)[key])}
              onChange={(event: { target: { value: string } }) =>
                onUpdate({
                  [key]: Number(event.target.value),
                } as Partial<TeamStatsInput>)
              }
            />
          </label>
        ))}
      </div>
      <p className="muted">Últimos 5 partidos del lado {prefix === 'home' ? 'local' : 'visitante'}.</p>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

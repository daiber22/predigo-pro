import { AnalysisResult, ComparisonRow, OddsMarketKey, TicketItem, TicketProfile } from '@/lib/types';

export type TicketBuildOptions = {
  profile: TicketProfile;
  maxPicks: number;
  allowedMarkets?: OddsMarketKey[];
};

type ScoredPick = {
  item: TicketItem;
  score: number;
};

const confidenceWeight: Record<AnalysisResult['confidence'], number> = {
  Alta: 1,
  Media: 0.72,
  Baja: 0.45,
};

function fixtureKey(analysis: AnalysisResult) {
  return analysis.fixtureId || `${analysis.homeTeam}-${analysis.awayTeam}`.toLowerCase();
}

function marketPreference(profile: TicketProfile, row: ComparisonRow) {
  const selection = row.selection.toLowerCase();
  const market = row.marketKey;

  if (profile === 'conservador') {
    if (market === 'double_chance') return 1.45;
    if (market === 'totals' && (selection.includes('under 3.5') || selection.includes('over 1.5'))) return 1.35;
    if (market === '1x2' && !selection.includes('empate')) return 0.8;
    if (market === 'btts' && selection.includes('no')) return 0.65;
    return 0.35;
  }

  if (profile === 'medio') {
    if (market === 'totals') return 1.2;
    if (market === '1x2') return 0.95;
    if (market === 'double_chance') return 0.85;
    if (market === 'btts') return 0.8;
    return 0.4;
  }

  if (market === '1x2') return 1.35;
  if (market === 'btts') return 1.05;
  if (market === 'totals' && selection.includes('over 2.5')) return 0.95;
  if (market === 'double_chance') return 0.35;
  return 0.6;
}

function profileEligibility(profile: TicketProfile, row: ComparisonRow, analysis: AnalysisResult) {
  if (row.odd <= 1.01 || row.edge <= -0.02) return false;

  if (profile === 'conservador') {
    return row.modelProbability >= 0.6 && row.odd <= 2.2 && analysis.confidence !== 'Baja';
  }

  if (profile === 'medio') {
    return row.modelProbability >= 0.52 && row.odd <= 3.4 && row.edge >= 0;
  }

  return row.modelProbability >= 0.38 && row.odd >= 1.55 && row.edge >= -0.01;
}

function scorePick(profile: TicketProfile, row: ComparisonRow, analysis: AnalysisResult) {
  const confidence = confidenceWeight[analysis.confidence];
  const preference = marketPreference(profile, row);

  if (profile === 'conservador') {
    const oddPenalty = Math.max(0, row.odd - 1.9) * 0.9;
    return row.modelProbability * 8 + row.edge * 20 + confidence * 2 + preference - oddPenalty;
  }

  if (profile === 'medio') {
    const oddBonus = row.odd >= 1.45 && row.odd <= 2.6 ? 0.8 : 0;
    return row.modelProbability * 6 + row.edge * 28 + confidence * 1.5 + preference + oddBonus;
  }

  const aggressiveOddBonus = Math.min(1.8, Math.max(0, row.odd - 1.55) * 0.9);
  return row.modelProbability * 4.6 + row.edge * 26 + confidence + preference + aggressiveOddBonus;
}

function rationaleForPick(profile: TicketProfile, row: ComparisonRow, analysis: AnalysisResult) {
  if (profile === 'conservador') {
    return `Perfil conservador: ${Math.round(row.modelProbability * 100)}% del modelo con cuota ${row.odd.toFixed(2)}.`;
  }
  if (profile === 'medio') {
    return `Perfil medio: edge de ${(row.edge * 100).toFixed(1)}% con cuota ${row.odd.toFixed(2)}.`;
  }
  return `Perfil agresivo: busca cuota más alta sin salir del edge útil (${(row.edge * 100).toFixed(1)}%).`;
}

export function pickForAnalysis(
  analysis: AnalysisResult,
  options: { profile: TicketProfile; allowedMarkets?: OddsMarketKey[] },
): TicketItem | null {
  const filteredRows = analysis.comparisons.filter((row) => {
    if (options.allowedMarkets?.length && !options.allowedMarkets.includes(row.marketKey)) {
      return false;
    }
    return profileEligibility(options.profile, row, analysis);
  });

  const sourceRows = filteredRows.length
    ? filteredRows
    : analysis.comparisons.filter((row) => {
        if (options.allowedMarkets?.length && !options.allowedMarkets.includes(row.marketKey)) {
          return false;
        }
        return row.edge >= -0.01;
      });

  if (!sourceRows.length) return null;

  const best = sourceRows
    .map((row) => ({ row, score: scorePick(options.profile, row, analysis) }))
    .sort((a, b) => b.score - a.score)[0]?.row;

  if (!best) return null;

  return {
    id: `${fixtureKey(analysis)}-${options.profile}-${Date.now()}-${best.marketKey}`,
    fixtureId: analysis.fixtureId,
    homeTeam: analysis.homeTeam,
    awayTeam: analysis.awayTeam,
    market: best.market,
    pick: best.selection,
    odd: best.odd,
    confidence: analysis.confidence,
    edge: best.edge,
    bookmaker: undefined,
    createdAt: new Date().toISOString(),
    profile: options.profile,
    rationale: rationaleForPick(options.profile, best, analysis),
  };
}

export function buildAutomaticTicket(analyses: AnalysisResult[], options: TicketBuildOptions): TicketItem[] {
  const deduped = new Map<string, AnalysisResult>();

  for (const analysis of analyses) {
    if (!analysis.comparisons?.length) continue;
    const key = fixtureKey(analysis);
    if (!deduped.has(key)) deduped.set(key, analysis);
  }

  const scored: ScoredPick[] = Array.from(deduped.values())
    .map((analysis) => {
      const pick = pickForAnalysis(analysis, {
        profile: options.profile,
        allowedMarkets: options.allowedMarkets,
      });

      if (!pick) return null;

      const row = analysis.comparisons.find(
        (item) => item.selection === pick.pick && item.market === pick.market,
      );

      const score = row ? scorePick(options.profile, row, analysis) : 0;
      return { item: pick, score };
    })
    .filter((value): value is ScoredPick => Boolean(value))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, options.maxPicks));

  return scored.map(({ item }) => item);
}

import { AnalysisResult, ComparisonRow, OddsResponse, TeamStatsInput } from '@/lib/types';

const round4 = (value: number) => Number(value.toFixed(4));

const safeLogit = (pct: number) => {
  const bounded = Math.min(99.999, Math.max(0.001, pct));
  return Math.log(bounded / (100 - bounded));
};

const poisson = (goals: number, lambda: number) => {
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial(goals);
};

const factorial = (value: number) => {
  if (value <= 1) return 1;
  let acc = 1;
  for (let i = 2; i <= value; i += 1) acc *= i;
  return acc;
};

const pickSignal = (edge: number) => {
  if (edge >= 0.06) return 'verde' as const;
  if (edge >= 0.02) return 'amarillo' as const;
  return 'rojo' as const;
};

const implied = (odd?: number) => (odd && odd > 0 ? 1 / odd : 0);

function buildComparisonRows(analysis: AnalysisResult, odds?: OddsResponse): ComparisonRow[] {
  if (!odds) return [];

  const sourceRows: Array<{ marketKey: '1x2' | 'totals' | 'btts' | 'double_chance'; market: string; selection: string; odd?: number; modelProbability: number }> = [
    { marketKey: '1x2', market: '1X2', selection: 'Local', odd: odds.odds.homeWin, modelProbability: analysis.p1 },
    { marketKey: '1x2', market: '1X2', selection: 'Empate', odd: odds.odds.draw, modelProbability: analysis.px },
    { marketKey: '1x2', market: '1X2', selection: 'Visitante', odd: odds.odds.awayWin, modelProbability: analysis.p2 },
    { marketKey: 'totals', market: 'Total', selection: 'Over 1.5', odd: odds.odds.over15, modelProbability: analysis.over15 },
    { marketKey: 'totals', market: 'Total', selection: 'Over 2.5', odd: odds.odds.over25, modelProbability: 1 - analysis.under25 },
    { marketKey: 'totals', market: 'Total', selection: 'Under 2.5', odd: odds.odds.under25, modelProbability: analysis.under25 },
    { marketKey: 'totals', market: 'Total', selection: 'Under 3.5', odd: odds.odds.under35, modelProbability: analysis.under35 },
    { marketKey: 'btts', market: 'BTTS', selection: 'Sí', odd: odds.odds.bttsYes, modelProbability: analysis.btts },
    { marketKey: 'btts', market: 'BTTS', selection: 'No', odd: odds.odds.bttsNo, modelProbability: 1 - analysis.btts },
    { marketKey: 'double_chance', market: 'Doble oportunidad', selection: 'Local o empate', odd: odds.odds.homeOrDraw, modelProbability: analysis.p1 + analysis.px },
    { marketKey: 'double_chance', market: 'Doble oportunidad', selection: 'Visitante o empate', odd: odds.odds.awayOrDraw, modelProbability: analysis.p2 + analysis.px },
  ];

  return sourceRows
    .filter((row) => row.odd)
    .map((row) => {
      const impliedProbability = implied(row.odd);
      const edge = row.modelProbability - impliedProbability;
      return {
        marketKey: row.marketKey,
        market: row.market,
        selection: row.selection,
        odd: row.odd as number,
        impliedProbability: round4(impliedProbability),
        modelProbability: round4(row.modelProbability),
        edge: round4(edge),
        signal: pickSignal(edge),
      };
    })
    .sort((a, b) => b.edge - a.edge);
}

export function analyzeMatch(stats: TeamStatsInput, odds?: OddsResponse): AnalysisResult {
  const attackHome = (stats.homeGoalsForGeneral / 5) * 0.4 + (stats.homeGoalsForHome / 5) * 0.6;
  const defenseHome = (stats.homeGoalsAgainstGeneral / 5) * 0.4 + (stats.homeGoalsAgainstHome / 5) * 0.6;
  const attackAway = (stats.awayGoalsForGeneral / 5) * 0.4 + (stats.awayGoalsForAway / 5) * 0.6;
  const defenseAway = (stats.awayGoalsAgainstGeneral / 5) * 0.4 + (stats.awayGoalsAgainstAway / 5) * 0.6;

  const scoreHomePct = (((attackHome * 0.6) + (defenseAway * 0.4)) / (((attackHome * 0.6) + (defenseAway * 0.4)) + ((attackAway * 0.6) + (defenseHome * 0.4)))) * 100;
  const scoreAwayPct = (((attackAway * 0.6) + (defenseHome * 0.4)) / (((attackHome * 0.6) + (defenseAway * 0.4)) + ((attackAway * 0.6) + (defenseHome * 0.4)))) * 100;
  const concedeHomePct = (((defenseHome * 0.6) + (attackAway * 0.4)) / (((defenseHome * 0.6) + (attackAway * 0.4)) + ((defenseAway * 0.6) + (attackHome * 0.4)))) * 100;
  const concedeAwayPct = (((defenseAway * 0.6) + (attackHome * 0.4)) / (((defenseHome * 0.6) + (attackAway * 0.4)) + ((defenseAway * 0.6) + (attackHome * 0.4)))) * 100;

  const lambdaHome = (attackHome + defenseAway) / 2;
  const lambdaAway = (attackAway + defenseHome) / 2;
  const totalLambda = lambdaHome + lambdaAway;
  const br = (safeLogit(scoreHomePct) + safeLogit(concedeAwayPct)) - (safeLogit(scoreAwayPct) + safeLogit(concedeHomePct));

  const typeBase: AnalysisResult['typeBase'] = totalLambda < 2.3 ? 'Corto' : totalLambda < 3.1 ? 'Medio' : 'Abierto';
  const sideBase: AnalysisResult['sideBase'] = Math.abs(br) <= 0.15 ? 'X' : br > 0 ? 'A' : 'B';

  const marketBase =
    typeBase === 'Abierto'
      ? sideBase === 'A'
        ? 'Local'
        : sideBase === 'B'
          ? 'Visitante'
          : 'BTTS'
      : sideBase === 'A'
        ? 'Local DNB'
        : sideBase === 'B'
          ? 'Visitante DNB'
          : 'Empate';

  const baseResult =
    typeBase === 'Corto'
      ? sideBase === 'A'
        ? '1-0'
        : sideBase === 'B'
          ? '0-1'
          : '0-0'
      : typeBase === 'Medio'
        ? sideBase === 'A'
          ? '2-1'
          : sideBase === 'B'
            ? '1-2'
            : '1-1'
        : sideBase === 'A'
          ? '3-1'
          : sideBase === 'B'
            ? '1-3'
            : '2-2';

  const scorelineLabels = ['0-0', '1-0', '0-1', '1-1', '2-0', '0-2', '2-1', '1-2', '2-2', '3-0', '0-3', '3-1', '1-3', '3-2', '2-3'];
  const scorelineMap: Record<string, number> = {
    '0-0': poisson(0, lambdaHome) * poisson(0, lambdaAway),
    '1-0': poisson(1, lambdaHome) * poisson(0, lambdaAway),
    '0-1': poisson(0, lambdaHome) * poisson(1, lambdaAway),
    '1-1': poisson(1, lambdaHome) * poisson(1, lambdaAway),
    '2-0': poisson(2, lambdaHome) * poisson(0, lambdaAway),
    '0-2': poisson(0, lambdaHome) * poisson(2, lambdaAway),
    '2-1': poisson(2, lambdaHome) * poisson(1, lambdaAway),
    '1-2': poisson(1, lambdaHome) * poisson(2, lambdaAway),
    '2-2': poisson(2, lambdaHome) * poisson(2, lambdaAway),
    '3-0': poisson(3, lambdaHome) * poisson(0, lambdaAway),
    '0-3': poisson(0, lambdaHome) * poisson(3, lambdaAway),
    '3-1': poisson(3, lambdaHome) * poisson(1, lambdaAway),
    '1-3': poisson(1, lambdaHome) * poisson(3, lambdaAway),
    '3-2': poisson(3, lambdaHome) * poisson(2, lambdaAway),
    '2-3': poisson(2, lambdaHome) * poisson(3, lambdaAway),
  };

  const p1 = scorelineMap['1-0'] + scorelineMap['2-0'] + scorelineMap['2-1'] + scorelineMap['3-0'] + scorelineMap['3-1'] + scorelineMap['3-2'];
  const px = scorelineMap['0-0'] + scorelineMap['1-1'] + scorelineMap['2-2'];
  const p2 = scorelineMap['0-1'] + scorelineMap['0-2'] + scorelineMap['1-2'] + scorelineMap['0-3'] + scorelineMap['1-3'] + scorelineMap['2-3'];
  const over15 = 1 - (scorelineMap['0-0'] + scorelineMap['1-0'] + scorelineMap['0-1']);
  const btts = scorelineMap['1-1'] + scorelineMap['2-1'] + scorelineMap['1-2'] + scorelineMap['2-2'] + scorelineMap['3-1'] + scorelineMap['1-3'] + scorelineMap['3-2'] + scorelineMap['2-3'];
  const under25 = scorelineMap['0-0'] + scorelineMap['1-0'] + scorelineMap['0-1'] + scorelineMap['1-1'] + scorelineMap['2-0'] + scorelineMap['0-2'];
  const under35 = under25 + scorelineMap['2-1'] + scorelineMap['1-2'] + scorelineMap['3-0'] + scorelineMap['0-3'];

  const topScores = scorelineLabels
    .map((score) => ({ score, probability: scorelineMap[score] }))
    .sort((a, b) => b.probability - a.probability);

  const poissonMarket =
    under35 >= 0.7
      ? 'Under 3.5'
      : under25 >= 0.55
        ? 'Under 2.5'
        : btts >= 0.55
          ? 'BTTS'
          : p1 >= Math.max(px, p2)
            ? 'Local'
            : p2 >= Math.max(p1, px)
              ? 'Visitante'
              : 'Empate';

  const confidence: AnalysisResult['confidence'] = under35 >= 0.72 || Math.abs(br) >= 0.8 ? 'Alta' : under35 >= 0.6 || Math.abs(br) >= 0.35 ? 'Media' : 'Baja';

  const analysis: AnalysisResult = {
    homeTeam: stats.homeTeam,
    awayTeam: stats.awayTeam,
    attackHome: round4(attackHome),
    defenseHome: round4(defenseHome),
    attackAway: round4(attackAway),
    defenseAway: round4(defenseAway),
    lambdaHome: round4(lambdaHome),
    lambdaAway: round4(lambdaAway),
    totalLambda: round4(totalLambda),
    br: round4(br),
    typeBase,
    sideBase,
    marketBase,
    baseResult,
    p1: round4(p1),
    px: round4(px),
    p2: round4(p2),
    over15: round4(over15),
    btts: round4(btts),
    under25: round4(under25),
    under35: round4(under35),
    poissonMarket,
    poissonTop1: topScores[0]?.score ?? baseResult,
    poissonTop2: topScores[1]?.score ?? baseResult,
    poissonTop3: topScores[2]?.score ?? baseResult,
    confidence,
    scorelines: topScores.slice(0, 5).map((item) => ({ score: item.score, probability: round4(item.probability) })),
    recommendation: {
      mainPick: poissonMarket,
      conservativePick: under35 >= 0.65 ? 'Under 3.5' : p1 + px >= 0.6 ? 'Local o empate' : p2 + px >= 0.6 ? 'Visitante o empate' : 'Over 1.5',
      aggressivePick: topScores[0]?.score ?? baseResult,
    },
    comparisons: [],
  };

  analysis.comparisons = buildComparisonRows(analysis, odds);
  return analysis;
}

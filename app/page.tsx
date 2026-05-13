"use client";

import { useEffect, useState } from "react";

type TeamForm = {
  pjGeneral: string;
  gfGeneral: string;
  gcGeneral: string;
  rpFavorGeneral: string;
  rpContraGeneral: string;
  rbFavorGeneral: string;
  rbContraGeneral: string;
  pjSplit: string;
  gfSplit: string;
  gcSplit: string;
  rpFavorSplit: string;
  rpContraSplit: string;
  rbFavorSplit: string;
  rbContraSplit: string;
};
type MatchInfo = {
  league: string;
  date: string;
  homeName: string;
  awayName: string;
};

type SavedAnalysis = {
  id: string;
  createdAt: string;
  matchInfo: MatchInfo;
  input: {
    local: TeamForm;
    visitante: TeamForm;
  };
  prediction: {
    predictedScore: string;
    lambdaLocal: number;
    lambdaVisitante: number;
    probabilities: {
      local: number;
      empate: number;
      visitante: number;
      over25: number;
      under25: number;
      btts: number;
      noBtts: number;
    };
    reading: string;
  };
  actual?: {
    homeGoals: number;
    awayGoals: number;
  };
};

function toNumber(value: string) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function safeAvg(total: number, matches: number) {
  if (!matches || matches <= 0) return 0;
  return total / matches;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function factorial(n: number) {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i += 1) result *= i;
  return result;
}

function poisson(k: number, lambda: number) {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
function buildReading(result: any) {
  const p = result.probabilities;

  const diffLocalVisitante = Math.abs(p.local - p.visitante);
  const totalLambda = result.lambdaLocal + result.lambdaVisitante;
  const diffLambda = Math.abs(result.lambdaLocal - result.lambdaVisitante);

  let main = "Partido equilibrado";
  const notes: string[] = [];

  if (diffLocalVisitante <= 0.05 && p.empate >= 0.23) {
    main = "Partido parejo con riesgo de empate";
  } else if (p.local > p.visitante && p.local >= 0.42) {
    main = "Ventaja local clara";
  } else if (p.visitante > p.local && p.visitante >= 0.42) {
    main = "Ventaja visitante clara";
  } else if (p.local > p.visitante) {
    main = "Leve ventaja local";
  } else if (p.visitante > p.local) {
    main = "Leve ventaja visitante";
  }

  if (p.empate >= 0.28) {
    notes.push("El empate tiene peso alto en el modelo.");
  } else if (p.empate >= 0.24) {
    notes.push("El empate está presente como escenario importante.");
  }

  if (p.over25 >= 0.58) {
    notes.push("Tendencia fuerte a Over 2.5 goles.");
  } else if (p.over25 >= 0.53) {
    notes.push("Tendencia moderada a Over 2.5 goles.");
  } else if (p.under25 >= 0.55) {
    notes.push("Tendencia a Under 2.5 goles.");
  }

  if (p.btts >= 0.58) {
    notes.push("Ambos marcan tiene señal fuerte.");
  } else if (p.btts >= 0.53) {
    notes.push("Ambos marcan tiene señal moderada.");
  } else if (p.noBtts >= 0.55) {
    notes.push("Hay tendencia a que no marquen ambos.");
  }

  if (totalLambda >= 2.8) {
    notes.push("La proyección total de goles es alta.");
  } else if (totalLambda <= 2.1) {
    notes.push("La proyección total de goles es baja.");
  }

  if (diffLambda <= 0.15) {
    notes.push("Los goles esperados están muy parejos.");
  }

  if (notes.length === 0) {
    notes.push("No hay una señal dominante; conviene revisar el top de marcadores.");
  }

  return {
    main,
    notes,
  };
}

function ReadingPanel({ result }: { result: any }) {
  const reading = buildReading(result);

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-slate-950 p-4">
      <div className="mb-2 font-semibold text-white">
        Lectura recomendada del partido
      </div>

      <div className="text-xl font-bold text-cyan-300">
        {reading.main}
      </div>

      <div className="mt-3 space-y-2 text-sm text-slate-300">
        {reading.notes.map((note: string, index: number) => (
          <div key={index}>• {note}</div>
        ))}
      </div>
    </div>
  );
}

function getPredictedOutcome(probabilities: SavedAnalysis["prediction"]["probabilities"]) {
  const values = [
    { key: "local", value: probabilities.local },
    { key: "empate", value: probabilities.empate },
    { key: "visitante", value: probabilities.visitante },
  ];

  return values.sort((a, b) => b.value - a.value)[0].key;
}

function getActualOutcome(homeGoals: number, awayGoals: number) {
  if (homeGoals > awayGoals) return "local";
  if (homeGoals === awayGoals) return "empate";
  return "visitante";
}

function parsePredictedScore(score: string) {
  const [home, away] = score.split("-").map((x) => Number(x));

  return {
    home: Number.isFinite(home) ? home : 0,
    away: Number.isFinite(away) ? away : 0,
  };
}

function evaluateAnalysis(item: SavedAnalysis) {
  if (!item.actual) return null;

  const actualHome = item.actual.homeGoals;
  const actualAway = item.actual.awayGoals;

  const predictedScore = parsePredictedScore(item.prediction.predictedScore);

  const predictedOutcome = getPredictedOutcome(item.prediction.probabilities);
  const actualOutcome = getActualOutcome(actualHome, actualAway);

  const predictedOver25 =
    item.prediction.probabilities.over25 >= item.prediction.probabilities.under25;
  const actualOver25 = actualHome + actualAway >= 3;

  const predictedBTTS =
    item.prediction.probabilities.btts >= item.prediction.probabilities.noBtts;
  const actualBTTS = actualHome >= 1 && actualAway >= 1;

  return {
    exactScoreHit:
      predictedScore.home === actualHome && predictedScore.away === actualAway,
    outcomeHit: predictedOutcome === actualOutcome,
    over25Hit: predictedOver25 === actualOver25,
    bttsHit: predictedBTTS === actualBTTS,
    predictedOutcome,
    actualOutcome,
    predictedOver25,
    actualOver25,
    predictedBTTS,
    actualBTTS,
  };
}

function buildAccuracySummary(items: SavedAnalysis[]) {
  const finished = items.filter((item) => item.actual);
  const total = finished.length;

  if (total === 0) {
    return {
      total: 0,
      exactScore: 0,
      outcome: 0,
      over25: 0,
      btts: 0,
    };
  }

  let exactScore = 0;
  let outcome = 0;
  let over25 = 0;
  let btts = 0;

  for (const item of finished) {
    const evaluation = evaluateAnalysis(item);
    if (!evaluation) continue;

    if (evaluation.exactScoreHit) exactScore += 1;
    if (evaluation.outcomeHit) outcome += 1;
    if (evaluation.over25Hit) over25 += 1;
    if (evaluation.bttsHit) btts += 1;
  }

  return {
    total,
    exactScore,
    outcome,
    over25,
    btts,
  };
}
function buildInitialTeam(): TeamForm {
  return {
    pjGeneral: "",
    gfGeneral: "",
    gcGeneral: "",
    rpFavorGeneral: "",
    rpContraGeneral: "",
    rbFavorGeneral: "",
    rbContraGeneral: "",
    pjSplit: "",
    gfSplit: "",
    gcSplit: "",
    rpFavorSplit: "",
    rpContraSplit: "",
    rbFavorSplit: "",
    rbContraSplit: "",
  };
}

function buildTeamMetrics(team: TeamForm, mode: "local" | "visitante") {
  const pjGeneral = toNumber(team.pjGeneral);
  const pjSplit = toNumber(team.pjSplit);

  const gfGeneral = safeAvg(toNumber(team.gfGeneral), pjGeneral);
  const gcGeneral = safeAvg(toNumber(team.gcGeneral), pjGeneral);
  const rpFavorGeneral = safeAvg(toNumber(team.rpFavorGeneral), pjGeneral);
  const rpContraGeneral = safeAvg(toNumber(team.rpContraGeneral), pjGeneral);
  const rbFavorGeneral = safeAvg(toNumber(team.rbFavorGeneral), pjGeneral);
  const rbContraGeneral = safeAvg(toNumber(team.rbContraGeneral), pjGeneral);

  const gfSplit = safeAvg(toNumber(team.gfSplit), pjSplit);
  const gcSplit = safeAvg(toNumber(team.gcSplit), pjSplit);
  const rpFavorSplit = safeAvg(toNumber(team.rpFavorSplit), pjSplit);
  const rpContraSplit = safeAvg(toNumber(team.rpContraSplit), pjSplit);
  const rbFavorSplit = safeAvg(toNumber(team.rbFavorSplit), pjSplit);
  const rbContraSplit = safeAvg(toNumber(team.rbContraSplit), pjSplit);

  const ataqueGoles = 0.4 * gfGeneral + 0.6 * gfSplit;
  const defensaGoles = 0.4 * gcGeneral + 0.6 * gcSplit;

  const ataqueRemates = 0.4 * rpFavorGeneral + 0.6 * rpFavorSplit;
  const defensaRemates = 0.4 * rpContraGeneral + 0.6 * rpContraSplit;

  const ataqueBloqueados = 0.4 * rbFavorGeneral + 0.6 * rbFavorSplit;
  const defensaBloqueados = 0.4 * rbContraGeneral + 0.6 * rbContraSplit;

 const compRematesAtaque = ataqueRemates / 3.2;
const compBloqueadosAtaque = ataqueBloqueados / 8;

const compRematesDefensa = defensaRemates / 3.2;
const compBloqueadosDefensa = defensaBloqueados / 8;

const fuerzaAtaque =
  0.70 * ataqueGoles +
  0.25 * compRematesAtaque +
  0.05 * compBloqueadosAtaque;

const fuerzaDefensa =
  0.70 * defensaGoles +
  0.25 * compRematesDefensa +
  0.05 * compBloqueadosDefensa;

  return {
    mode,
    matches: {
      general: pjGeneral,
      split: pjSplit,
    },
    averages: {
      gfGeneral,
      gcGeneral,
      rpFavorGeneral,
      rpContraGeneral,
      rbFavorGeneral,
      rbContraGeneral,
      gfSplit,
      gcSplit,
      rpFavorSplit,
      rpContraSplit,
      rbFavorSplit,
      rbContraSplit,
    },
    weighted: {
      ataqueGoles,
      defensaGoles,
      ataqueRemates,
      defensaRemates,
      ataqueBloqueados,
      defensaBloqueados,
     compRematesAtaque,
compBloqueadosAtaque,
compRematesDefensa,
compBloqueadosDefensa,
      fuerzaAtaque,
      fuerzaDefensa,
    },
  };
}

function calculateAnalysis(local: TeamForm, visitante: TeamForm) {
  const localMetrics = buildTeamMetrics(local, "local");
  const visitanteMetrics = buildTeamMetrics(visitante, "visitante");

  const lambdaLocal = clamp(
    (localMetrics.weighted.fuerzaAtaque + visitanteMetrics.weighted.fuerzaDefensa) / 2,
    0.15,
    3.5
  );

  const lambdaVisitante = clamp(
    (visitanteMetrics.weighted.fuerzaAtaque + localMetrics.weighted.fuerzaDefensa) / 2,
    0.15,
    3.5
  );

  const maxGoals = 5;
  const matrix: { home: number; away: number; probability: number }[] = [];

  let probLocal = 0;
  let probEmpate = 0;
  let probVisitante = 0;
  let probOver25 = 0;
  let probBTTS = 0;

  for (let i = 0; i <= maxGoals; i += 1) {
    for (let j = 0; j <= maxGoals; j += 1) {
      const probability = poisson(i, lambdaLocal) * poisson(j, lambdaVisitante);
      matrix.push({ home: i, away: j, probability });

      if (i > j) probLocal += probability;
      if (i === j) probEmpate += probability;
      if (i < j) probVisitante += probability;
      if (i + j >= 3) probOver25 += probability;
      if (i >= 1 && j >= 1) probBTTS += probability;
    }
  }

  const topScores = [...matrix]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  const predicted = topScores[0];

  return {
    lambdaLocal,
    lambdaVisitante,
    probabilities: {
      local: probLocal,
      empate: probEmpate,
      visitante: probVisitante,
      over25: probOver25,
      under25: 1 - probOver25,
      btts: probBTTS,
      noBtts: 1 - probBTTS,
    },
    topScores,
    predictedScore: predicted ? `${predicted.home}-${predicted.away}` : "0-0",
    localMetrics,
    visitanteMetrics,
  };
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-cyan-300">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
      />
    </div>
  );
}

export default function Page() {
  const [local, setLocal] = useState<TeamForm>(buildInitialTeam());
  const [visitante, setVisitante] = useState<TeamForm>(buildInitialTeam());
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<
  "info" | "local" | "visitante" | "resultado" | "historial"
>("info");
  const [matchInfo, setMatchInfo] = useState<MatchInfo>({
  league: "",
  date: "",
  homeName: "",
  awayName: "",
});

const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  useEffect(() => {
  const raw = window.localStorage.getItem("predigo_saved_analyses_v1");
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      setSavedAnalyses(parsed);
    }
  } catch {
    setSavedAnalyses([]);
  }
}, []);

useEffect(() => {
  window.localStorage.setItem(
    "predigo_saved_analyses_v1",
    JSON.stringify(savedAnalyses)
  );
}, [savedAnalyses]);

  function updateLocal(key: keyof TeamForm, value: string) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function updateVisitante(key: keyof TeamForm, value: string) {
    setVisitante((prev) => ({ ...prev, [key]: value }));
  }

  function handleAnalyze() {
    const requiredMatches = [
      toNumber(local.pjGeneral),
      toNumber(local.pjSplit),
      toNumber(visitante.pjGeneral),
      toNumber(visitante.pjSplit),
    ];

    if (requiredMatches.some((value) => value <= 0)) {
      setMessage("Los 4 campos de partidos jugados deben ser mayores que 0.");
      setResult(null);
      return;
    }

    const analysis = calculateAnalysis(local, visitante);
    setResult(analysis);
    setMessage("Análisis calculado correctamente.");
  }

 function handleClear() {
  setLocal(buildInitialTeam());
  setVisitante(buildInitialTeam());
  setResult(null);
  setMessage("");
}

function updateMatchInfo(key: keyof MatchInfo, value: string) {
  setMatchInfo((prev) => ({ ...prev, [key]: value }));
}

function saveCurrentAnalysis() {
  if (!result) {
    setMessage("Primero calcula un análisis antes de guardar.");
    return;
  }

  const reading = buildReading(result);

  const item: SavedAnalysis = {
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
    matchInfo: {
      league: matchInfo.league || "Sin liga",
      date: matchInfo.date || "",
      homeName: matchInfo.homeName || "Local",
      awayName: matchInfo.awayName || "Visitante",
    },
    input: {
      local,
      visitante,
    },
    prediction: {
      predictedScore: result.predictedScore,
      lambdaLocal: result.lambdaLocal,
      lambdaVisitante: result.lambdaVisitante,
      probabilities: result.probabilities,
      reading: reading.main,
    },
  };

  setSavedAnalyses((prev) => [item, ...prev]);
  setMessage("Análisis guardado correctamente.");
}

function updateActualResult(
  id: string,
  side: "homeGoals" | "awayGoals",
  value: string
) {
  const numericValue = Number(value);

  setSavedAnalyses((prev) =>
    prev.map((item) => {
      if (item.id !== id) return item;

      const currentActual = item.actual || {
        homeGoals: 0,
        awayGoals: 0,
      };

      return {
        ...item,
        actual: {
          ...currentActual,
          [side]: Number.isFinite(numericValue) ? numericValue : 0,
        },
      };
    })
  );
}

function deleteSavedAnalysis(id: string) {
  setSavedAnalyses((prev) => prev.filter((item) => item.id !== id));
}

  const card =
    "rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4 shadow-lg shadow-cyan-900/10";
  const sectionTitle = "mb-4 text-xl font-semibold text-cyan-300";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-7xl">
        <h1 className="mb-2 text-3xl font-bold">Predigo Pro</h1>
        <p className="mb-2 text-slate-300">
          Modo manual con goles, remates a puerta y remates bloqueados.
        </p>
        <p className="mb-6 text-sm text-slate-400">
          La app usa 40% general, 60% local/visitante, y mezcla 70% goles con 30%
          componente de remates.
        </p>
        <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-3">
  <button
    onClick={() => setActiveTab("info")}
    className={`rounded-xl px-4 py-2 font-semibold ${
      activeTab === "info"
        ? "bg-cyan-400 text-slate-950"
        : "bg-slate-800 text-white hover:bg-slate-700"
    }`}
  >
    Información
  </button>

 
 

 

  <button
    onClick={() => setActiveTab("resultado")}
    className={`rounded-xl px-4 py-2 font-semibold ${
      activeTab === "resultado"
        ? "bg-cyan-400 text-slate-950"
        : "bg-slate-800 text-white hover:bg-slate-700"
    }`}
  >
    Resultado
  </button>

  <button
    onClick={() => setActiveTab("historial")}
    className={`rounded-xl px-4 py-2 font-semibold ${
      activeTab === "historial"
        ? "bg-cyan-400 text-slate-950"
        : "bg-slate-800 text-white hover:bg-slate-700"
    }`}
  >
    Historial
  </button>
</div>

       <div
  className={
    activeTab === "info"
      ? "mb-6 rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4"
      : "hidden"
  }
>
  <h2 className="mb-4 text-xl font-semibold text-cyan-300">
    Información del partido
  </h2>

  <div className="grid gap-4 md:grid-cols-4">
    <div>
      <label className="mb-1 block text-sm text-cyan-300">Liga</label>
      <input
        value={matchInfo.league}
        onChange={(e) => updateMatchInfo("league", e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
      />
    </div>

    <div>
      <label className="mb-1 block text-sm text-cyan-300">Fecha</label>
      <input
        type="date"
        value={matchInfo.date}
        onChange={(e) => updateMatchInfo("date", e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
      />
    </div>

    <div>
      <label className="mb-1 block text-sm text-cyan-300">Equipo local</label>
      <input
        value={matchInfo.homeName}
        onChange={(e) => updateMatchInfo("homeName", e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
      />
    </div>

    <div>
      <label className="mb-1 block text-sm text-cyan-300">Equipo visitante</label>
      <input
        value={matchInfo.awayName}
        onChange={(e) => updateMatchInfo("awayName", e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400"
      />
    </div>
  </div>
</div>
      <div className={activeTab === "info" ? "grid grid-cols-2 gap-4 items-start" : "hidden"}>
         <section className={card}>
            <h2 className={sectionTitle}>1. Equipo local</h2>

            <div className="mb-4 text-sm font-semibold text-cyan-200">General</div>
            <div className="grid gap-4 md:grid-cols-2">
              <NumberInput
                label="Partidos jugados general"
                value={local.pjGeneral}
                onChange={(v) => updateLocal("pjGeneral", v)}
              />
              <NumberInput
                label="Goles a favor general"
                value={local.gfGeneral}
                onChange={(v) => updateLocal("gfGeneral", v)}
              />
              <NumberInput
                label="Goles en contra general"
                value={local.gcGeneral}
                onChange={(v) => updateLocal("gcGeneral", v)}
              />
              <NumberInput
                label="Remates a puerta a favor general"
                value={local.rpFavorGeneral}
                onChange={(v) => updateLocal("rpFavorGeneral", v)}
              />
              <NumberInput
                label="Remates a puerta recibidos general"
                value={local.rpContraGeneral}
                onChange={(v) => updateLocal("rpContraGeneral", v)}
              />
              <NumberInput
                label="Remates bloqueados a favor general"
                value={local.rbFavorGeneral}
                onChange={(v) => updateLocal("rbFavorGeneral", v)}
              />
              <NumberInput
                label="Remates bloqueados recibidos general"
                value={local.rbContraGeneral}
                onChange={(v) => updateLocal("rbContraGeneral", v)}
              />
            </div>

            <div className="mb-4 mt-6 text-sm font-semibold text-cyan-200">Como local</div>
            <div className="grid gap-4 md:grid-cols-2">
              <NumberInput
                label="Partidos jugados como local"
                value={local.pjSplit}
                onChange={(v) => updateLocal("pjSplit", v)}
              />
              <NumberInput
                label="Goles a favor como local"
                value={local.gfSplit}
                onChange={(v) => updateLocal("gfSplit", v)}
              />
              <NumberInput
                label="Goles en contra como local"
                value={local.gcSplit}
                onChange={(v) => updateLocal("gcSplit", v)}
              />
              <NumberInput
                label="Remates a puerta a favor como local"
                value={local.rpFavorSplit}
                onChange={(v) => updateLocal("rpFavorSplit", v)}
              />
              <NumberInput
                label="Remates a puerta recibidos como local"
                value={local.rpContraSplit}
                onChange={(v) => updateLocal("rpContraSplit", v)}
              />
              <NumberInput
                label="Remates bloqueados a favor como local"
                value={local.rbFavorSplit}
                onChange={(v) => updateLocal("rbFavorSplit", v)}
              />
              <NumberInput
                label="Remates bloqueados recibidos como local"
                value={local.rbContraSplit}
                onChange={(v) => updateLocal("rbContraSplit", v)}
              />
            </div>
          </section>

         <section className={card}>
            <h2 className={sectionTitle}>2. Equipo visitante</h2>

            <div className="mb-4 text-sm font-semibold text-cyan-200">General</div>
            <div className="grid gap-4 md:grid-cols-2">
              <NumberInput
                label="Partidos jugados general"
                value={visitante.pjGeneral}
                onChange={(v) => updateVisitante("pjGeneral", v)}
              />
              <NumberInput
                label="Goles a favor general"
                value={visitante.gfGeneral}
                onChange={(v) => updateVisitante("gfGeneral", v)}
              />
              <NumberInput
                label="Goles en contra general"
                value={visitante.gcGeneral}
                onChange={(v) => updateVisitante("gcGeneral", v)}
              />
              <NumberInput
                label="Remates a puerta a favor general"
                value={visitante.rpFavorGeneral}
                onChange={(v) => updateVisitante("rpFavorGeneral", v)}
              />
              <NumberInput
                label="Remates a puerta recibidos general"
                value={visitante.rpContraGeneral}
                onChange={(v) => updateVisitante("rpContraGeneral", v)}
              />
              <NumberInput
                label="Remates bloqueados a favor general"
                value={visitante.rbFavorGeneral}
                onChange={(v) => updateVisitante("rbFavorGeneral", v)}
              />
              <NumberInput
                label="Remates bloqueados recibidos general"
                value={visitante.rbContraGeneral}
                onChange={(v) => updateVisitante("rbContraGeneral", v)}
              />
            </div>

            <div className="mb-4 mt-6 text-sm font-semibold text-cyan-200">Como visitante</div>
            <div className="grid gap-4 md:grid-cols-2">
              <NumberInput
                label="Partidos jugados como visitante"
                value={visitante.pjSplit}
                onChange={(v) => updateVisitante("pjSplit", v)}
              />
              <NumberInput
                label="Goles a favor como visitante"
                value={visitante.gfSplit}
                onChange={(v) => updateVisitante("gfSplit", v)}
              />
              <NumberInput
                label="Goles en contra como visitante"
                value={visitante.gcSplit}
                onChange={(v) => updateVisitante("gcSplit", v)}
              />
              <NumberInput
                label="Remates a puerta a favor como visitante"
                value={visitante.rpFavorSplit}
                onChange={(v) => updateVisitante("rpFavorSplit", v)}
              />
              <NumberInput
                label="Remates a puerta recibidos como visitante"
                value={visitante.rpContraSplit}
                onChange={(v) => updateVisitante("rpContraSplit", v)}
              />
              <NumberInput
                label="Remates bloqueados a favor como visitante"
                value={visitante.rbFavorSplit}
                onChange={(v) => updateVisitante("rbFavorSplit", v)}
              />
              <NumberInput
                label="Remates bloqueados recibidos como visitante"
                value={visitante.rbContraSplit}
                onChange={(v) => updateVisitante("rbContraSplit", v)}
              />
            </div>
          </section>
        </div>

       <div
  className={
    activeTab === "resultado"
      ? "mt-6 rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4"
      : "hidden"
  }
>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleAnalyze}
              className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
            >
              Calcular análisis
            </button>

            <button
              onClick={handleClear}
              className="rounded-xl bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-600"
            >
              Limpiar
            </button>
            <button
  onClick={saveCurrentAnalysis}
  className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
>
  Guardar análisis
</button>
          </div>

          {message && (
            <div className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-950 p-3 text-sm">
              <span className="font-semibold text-cyan-300">Estado:</span> {message}
            </div>
          )}
        </div>

        <div className={activeTab === "resultado" ? "mt-6 grid gap-6 lg:grid-cols-2" : "hidden"}>
          <section className={card}>
            <h2 className={sectionTitle}>3. Resultado probable</h2>

            {!result && (
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-300">
                Aún no hay análisis calculado.
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-500/20 bg-slate-950 p-4">
                  <div className="text-sm text-slate-300">Marcador más probable</div>
                  <div className="mt-1 text-3xl font-bold text-cyan-300">
                    {result.predictedScore}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 font-semibold text-white">Goles esperados</div>
                  <div className="text-sm">
                    Local: <strong>{result.lambdaLocal.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm">
                    Visitante: <strong>{result.lambdaVisitante.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 font-semibold text-white">Probabilidades</div>
                  <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                    <div>Local: <strong>{pct(result.probabilities.local)}</strong></div>
                    <div>Empate: <strong>{pct(result.probabilities.empate)}</strong></div>
                    <div>Visitante: <strong>{pct(result.probabilities.visitante)}</strong></div>
                    <div>Over 2.5: <strong>{pct(result.probabilities.over25)}</strong></div>
                    <div>Under 2.5: <strong>{pct(result.probabilities.under25)}</strong></div>
                    <div>Ambos marcan: <strong>{pct(result.probabilities.btts)}</strong></div>
                  </div>
                </div>
<ReadingPanel result={result} />
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 font-semibold text-white">Top 5 marcadores</div>
                  <div className="space-y-2 text-sm">
                    {result.topScores.map((item: any, idx: number) => (
                      <div
                        key={`${item.home}-${item.away}-${idx}`}
                        className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2"
                      >
                        <span>{item.home}-{item.away}</span>
                        <strong>{(item.probability * 100).toFixed(2)}%</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className={sectionTitle}>4. Comparación interna</h2>

            {!result && (
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-300">
                Calcula el análisis para ver la comparación.
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 font-semibold text-white">Fuerza por goles</div>
                  <div className="text-sm">
                    Ataque local: <strong>{result.localMetrics.weighted.ataqueGoles.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm">
                    Ataque visitante: <strong>{result.visitanteMetrics.weighted.ataqueGoles.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm mt-2">
                    Defensa local: <strong>{result.localMetrics.weighted.defensaGoles.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm">
                    Defensa visitante: <strong>{result.visitanteMetrics.weighted.defensaGoles.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 font-semibold text-white">Fuerza por remates a puerta</div>
                  <div className="text-sm">
                    Ataque local: <strong>{result.localMetrics.weighted.ataqueRemates.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm">
                    Ataque visitante: <strong>{result.visitanteMetrics.weighted.ataqueRemates.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm mt-2">
                    Defensa local: <strong>{result.localMetrics.weighted.defensaRemates.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm">
                    Defensa visitante: <strong>{result.visitanteMetrics.weighted.defensaRemates.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 font-semibold text-white">Bloqueados y componente final</div>
                  <div className="text-sm">
                    Ataque bloqueados local: <strong>{result.localMetrics.weighted.ataqueBloqueados.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm">
                    Ataque bloqueados visitante: <strong>{result.visitanteMetrics.weighted.ataqueBloqueados.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm mt-2">
                    Fuerza ataque local: <strong>{result.localMetrics.weighted.fuerzaAtaque.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm">
                    Fuerza ataque visitante: <strong>{result.visitanteMetrics.weighted.fuerzaAtaque.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
       <div
  className={
    activeTab === "historial"
      ? "mt-6 rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4"
      : "hidden"
  }
>
  <h2 className="mb-4 text-xl font-semibold text-cyan-300">
    5. Historial y control de aciertos
  </h2>

  {(() => {
    const summary = buildAccuracySummary(savedAnalyses);

    return (
      <div className="mb-4 grid gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="text-sm text-slate-400">Partidos cerrados</div>
          <div className="text-2xl font-bold text-cyan-300">{summary.total}</div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="text-sm text-slate-400">Marcador exacto</div>
          <div className="text-2xl font-bold text-cyan-300">
            {summary.total ? pct(summary.exactScore / summary.total) : "0.0%"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="text-sm text-slate-400">Ganador 1X2</div>
          <div className="text-2xl font-bold text-cyan-300">
            {summary.total ? pct(summary.outcome / summary.total) : "0.0%"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="text-sm text-slate-400">Over/Under 2.5</div>
          <div className="text-2xl font-bold text-cyan-300">
            {summary.total ? pct(summary.over25 / summary.total) : "0.0%"}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3">
          <div className="text-sm text-slate-400">Ambos marcan</div>
          <div className="text-2xl font-bold text-cyan-300">
            {summary.total ? pct(summary.btts / summary.total) : "0.0%"}
          </div>
        </div>
      </div>
    );
  })()}

  {savedAnalyses.length === 0 && (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-300">
      Todavía no hay análisis guardados.
    </div>
  )}

  <div className="space-y-4">
    {savedAnalyses.map((item) => {
      const evaluation = evaluateAnalysis(item);

      return (
        <div
          key={item.id}
          className="rounded-xl border border-slate-700 bg-slate-950 p-4"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-white">
                {item.matchInfo.homeName} vs {item.matchInfo.awayName}
              </div>
              <div className="text-sm text-slate-400">
                {item.matchInfo.league} {item.matchInfo.date ? `• ${item.matchInfo.date}` : ""}
              </div>
            </div>

            <button
              onClick={() => deleteSavedAnalysis(item.id)}
              className="rounded-lg bg-red-500/20 px-3 py-1 text-sm text-red-300 hover:bg-red-500/30"
            >
              Borrar
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <div className="text-sm text-slate-400">Marcador previsto</div>
              <div className="text-xl font-bold text-cyan-300">
                {item.prediction.predictedScore}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400">Lectura</div>
              <div className="font-semibold text-white">
                {item.prediction.reading}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400">Lambda local</div>
              <div className="font-semibold text-white">
                {item.prediction.lambdaLocal.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-sm text-slate-400">Lambda visitante</div>
              <div className="font-semibold text-white">
                {item.prediction.lambdaVisitante.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-cyan-300">
                Goles reales local
              </label>
              <input
                type="number"
                value={item.actual?.homeGoals ?? ""}
                onChange={(e) =>
                  updateActualResult(item.id, "homeGoals", e.target.value)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-cyan-300">
                Goles reales visitante
              </label>
              <input
                type="number"
                value={item.actual?.awayGoals ?? ""}
                onChange={(e) =>
                  updateActualResult(item.id, "awayGoals", e.target.value)
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {evaluation && (
            <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
              <div>
                Marcador exacto:{" "}
                <strong className={evaluation.exactScoreHit ? "text-emerald-300" : "text-red-300"}>
                  {evaluation.exactScoreHit ? "Acierto" : "Fallo"}
                </strong>
              </div>

              <div>
                1X2:{" "}
                <strong className={evaluation.outcomeHit ? "text-emerald-300" : "text-red-300"}>
                  {evaluation.outcomeHit ? "Acierto" : "Fallo"}
                </strong>
              </div>

              <div>
                Over/Under:{" "}
                <strong className={evaluation.over25Hit ? "text-emerald-300" : "text-red-300"}>
                  {evaluation.over25Hit ? "Acierto" : "Fallo"}
                </strong>
              </div>

              <div>
                Ambos marcan:{" "}
                <strong className={evaluation.bttsHit ? "text-emerald-300" : "text-red-300"}>
                  {evaluation.bttsHit ? "Acierto" : "Fallo"}
                </strong>
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
</div>
      </div>
    </main>
  );
}

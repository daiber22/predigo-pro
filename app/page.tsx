"use client";

import { useState } from "react";

type FormState = {
  league: string;
  country: string;
  season: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
};

export default function Page() {
  const [form, setForm] = useState<FormState>({
    league: "Colombia Primera A",
    country: "Colombia",
    season: "2025",
    homeTeam: "Junior",
    awayTeam: "Once Caldas",
    matchDate: "",
  });

  const [loading, setLoading] = useState<"" | "test" | "search" | "analyze">("");
  const [apiStatus, setApiStatus] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [fixtureData, setFixtureData] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<any>(null);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function testApi() {
    try {
      setLoading("test");
      setApiStatus("Probando conexión...");
      const res = await fetch("/api/test-api", { cache: "no-store" });
      const data = await res.json();

      if (!data.ok) {
        setApiStatus(data.error || "Falló la conexión");
        return;
      }

      setApiStatus(`${data.message}. Ligas encontradas: ${data.total}`);
    } catch (error: any) {
      setApiStatus(error?.message || "Error probando conexión");
    } finally {
      setLoading("");
    }
  }

  async function buscarPartido() {
    try {
      setLoading("search");
      setSearchStatus("Buscando partido...");
      setAnalysisData(null);

      const res = await fetch("/api/find-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.ok) {
        setFixtureData(null);
        setSearchStatus(data.error || "No encontré el partido");
        return;
      }

      setFixtureData(data);
      setSearchStatus(`Partido encontrado. Fixture ID: ${data.fixtureId}`);
    } catch (error: any) {
      setFixtureData(null);
      setSearchStatus(error?.message || "Error buscando partido");
    } finally {
      setLoading("");
    }
  }

  async function analizarPartido() {
    try {
      setLoading("analyze");
      setSearchStatus("Analizando partido...");

      const res = await fetch("/api/analyze-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!data.ok) {
        setAnalysisData(null);
        setSearchStatus(data.error || "No pude analizar el partido");
        return;
      }

      setFixtureData({
        fixtureId: data.fixtureId,
        fixture: data.fixture,
        leagueId: data.ids?.leagueId,
        homeId: data.ids?.homeId,
        awayId: data.ids?.awayId,
      });

      setAnalysisData(data);
      setSearchStatus("Análisis completado correctamente");
    } catch (error: any) {
      setAnalysisData(null);
      setSearchStatus(error?.message || "Error analizando partido");
    } finally {
      setLoading("");
    }
  }

  const card =
    "rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-4 shadow-lg shadow-cyan-900/10";
  const input =
    "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-cyan-400";
  const label = "mb-1 block text-sm text-cyan-300";
  const btnPrimary =
    "rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50";
  const btnSecondary =
    "rounded-xl bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-600 disabled:opacity-50";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-3xl font-bold">Predigo Pro</h1>
        <p className="mb-6 text-slate-300">
          Versión corregida para buscar fixture y analizar con Poisson.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <section className={card}>
            <h2 className="mb-4 text-xl font-semibold text-cyan-300">
              1. Buscar partido
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={label}>Liga</label>
                <input
                  className={input}
                  value={form.league}
                  onChange={(e) => updateField("league", e.target.value)}
                />
              </div>

              <div>
                <label className={label}>País</label>
                <input
                  className={input}
                  value={form.country}
                  onChange={(e) => updateField("country", e.target.value)}
                />
              </div>

              <div>
                <label className={label}>Temporada</label>
                <input
                  className={input}
                  value={form.season}
                  onChange={(e) => updateField("season", e.target.value)}
                />
              </div>

              <div>
                <label className={label}>Fecha</label>
                <input
                  type="date"
                  className={input}
                  value={form.matchDate}
                  onChange={(e) => updateField("matchDate", e.target.value)}
                />
              </div>

              <div>
                <label className={label}>Equipo local</label>
                <input
                  className={input}
                  value={form.homeTeam}
                  onChange={(e) => updateField("homeTeam", e.target.value)}
                />
              </div>

              <div>
                <label className={label}>Equipo visitante</label>
                <input
                  className={input}
                  value={form.awayTeam}
                  onChange={(e) => updateField("awayTeam", e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                className={btnSecondary}
                onClick={testApi}
                disabled={loading !== ""}
              >
                {loading === "test" ? "Probando..." : "Probar conexión API"}
              </button>

              <button
                className={btnPrimary}
                onClick={buscarPartido}
                disabled={loading !== ""}
              >
                {loading === "search" ? "Buscando..." : "Buscar partido"}
              </button>

              <button
                className={btnSecondary}
                onClick={analizarPartido}
                disabled={loading !== ""}
              >
                {loading === "analyze" ? "Analizando..." : "Analizar partido"}
              </button>
            </div>

            {apiStatus && (
              <div className="mt-4 rounded-xl border border-cyan-500/20 bg-slate-950 p-3 text-sm">
                <span className="font-semibold text-cyan-300">API:</span>{" "}
                {apiStatus}
              </div>
            )}

            {searchStatus && (
              <div className="mt-3 rounded-xl border border-cyan-500/20 bg-slate-950 p-3 text-sm">
                <span className="font-semibold text-cyan-300">Estado:</span>{" "}
                {searchStatus}
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className="mb-4 text-xl font-semibold text-cyan-300">
              2. Resultado
            </h2>

            {!fixtureData && !analysisData && (
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-300">
                Aún no hay partido cargado.
              </div>
            )}

            {fixtureData && (
              <div className="mb-4 rounded-xl border border-slate-700 bg-slate-950 p-4">
                <div className="mb-2 text-lg font-semibold text-white">
                  {fixtureData?.fixture?.home} vs {fixtureData?.fixture?.away}
                </div>
                <div className="text-sm text-slate-300">
                  Liga: {fixtureData?.fixture?.league}
                </div>
                <div className="text-sm text-slate-300">
                  País: {fixtureData?.fixture?.country}
                </div>
                <div className="text-sm text-slate-300">
                  Fecha: {fixtureData?.fixture?.date || "Sin fecha"}
                </div>
                <div className="text-sm text-slate-300">
                  Estadio: {fixtureData?.fixture?.venue || "Sin estadio"}
                </div>
                <div className="mt-2 text-sm text-cyan-300">
                  Fixture ID: {fixtureData?.fixtureId}
                </div>
              </div>
            )}

            {analysisData && (
              <div className="space-y-4">
                <div className="rounded-xl border border-cyan-500/20 bg-slate-950 p-4">
                  <div className="text-sm text-slate-300">Marcador más probable</div>
                  <div className="mt-1 text-3xl font-bold text-cyan-300">
                    {analysisData?.prediction?.predictedScore}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 font-semibold text-white">Probabilidades</div>
                  <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                    <div>
                      Local:{" "}
                      <strong>
                        {(analysisData?.prediction?.probabilities?.homeWin * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div>
                      Empate:{" "}
                      <strong>
                        {(analysisData?.prediction?.probabilities?.draw * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div>
                      Visitante:{" "}
                      <strong>
                        {(analysisData?.prediction?.probabilities?.awayWin * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div>
                      Over 2.5:{" "}
                      <strong>
                        {(analysisData?.prediction?.probabilities?.over25 * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div>
                      Under 2.5:{" "}
                      <strong>
                        {(analysisData?.prediction?.probabilities?.under25 * 100).toFixed(1)}%
                      </strong>
                    </div>
                    <div>
                      Ambos marcan:{" "}
                      <strong>
                        {(analysisData?.prediction?.probabilities?.btts * 100).toFixed(1)}%
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 font-semibold text-white">Goles esperados</div>
                  <div className="text-sm">
                    Local:{" "}
                    <strong>{analysisData?.prediction?.lambdaHome?.toFixed(2)}</strong>
                  </div>
                  <div className="text-sm">
                    Visitante:{" "}
                    <strong>{analysisData?.prediction?.lambdaAway?.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                  <div className="mb-2 font-semibold text-white">
                    Top marcadores probables
                  </div>
                  <div className="space-y-2 text-sm">
                    {(analysisData?.prediction?.topScores || []).map(
                      (item: any, idx: number) => (
                        <div
                          key={`${item.score}-${idx}`}
                          className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2"
                        >
                          <span>{item.score}</span>
                          <strong>{(item.probability * 100).toFixed(2)}%</strong>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

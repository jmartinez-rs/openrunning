import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calculator,
  Flame,
  HeartPulse,
  Gauge,
  Trophy,
  ArrowRightLeft,
  Sparkles,
  Info,
} from "lucide-react";

import {
  calculateVDOT,
  getTrainingPaces,
  predictTimeRiegel,
  calculateHeartRateZones,
  formatPace,
  formatTime,
  paceSecondsToKmh,
} from "@/lib/running-math";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_layout/tools")({
  component: ToolsView,
  head: () => ({
    meta: [{ title: "Calculadoras de Running - OpenRunning" }],
  }),
});

const STANDARD_DISTANCES = [
  { label: "5K (5.0 km)", meters: 5000 },
  { label: "10K (10.0 km)", meters: 10000 },
  { label: "15K (15.0 km)", meters: 15000 },
  { label: "21.1K (Media Maratón)", meters: 21097 },
  { label: "42.2K (Maratón)", meters: 42195 },
];

function ToolsView() {
  const [activeTab, setActiveTab] = useState("vdot");

  // VDOT Calculator State
  const [vdotDistanceMeters, setVdotDistanceMeters] = useState(10000);
  const [vdotHours, setVdotHours] = useState(0);
  const [vdotMinutes, setVdotMinutes] = useState(48);
  const [vdotSeconds, setVdotSeconds] = useState(30);

  const totalVdotTimeSeconds = useMemo(
    () => vdotHours * 3600 + vdotMinutes * 60 + vdotSeconds,
    [vdotHours, vdotMinutes, vdotSeconds]
  );

  const calculatedVdot = useMemo(
    () => calculateVDOT(vdotDistanceMeters, totalVdotTimeSeconds),
    [vdotDistanceMeters, totalVdotTimeSeconds]
  );

  const trainingPaces = useMemo(
    () => getTrainingPaces(calculatedVdot),
    [calculatedVdot]
  );

  // Riegel Predictor State
  const [riegelDistanceMeters, setRiegelDistanceMeters] = useState(10000);
  const [riegelHours, setRiegelHours] = useState(0);
  const [riegelMinutes, setRiegelMinutes] = useState(48);
  const [riegelSeconds, setRiegelSeconds] = useState(30);

  const totalRiegelTimeSeconds = useMemo(
    () => riegelHours * 3600 + riegelMinutes * 60 + riegelSeconds,
    [riegelHours, riegelMinutes, riegelSeconds]
  );

  const riegelProjections = useMemo(() => {
    return STANDARD_DISTANCES.map((dist) => {
      const predictedSecs = predictTimeRiegel(
        riegelDistanceMeters,
        totalRiegelTimeSeconds,
        dist.meters
      );
      const paceSecs = predictedSecs > 0 ? predictedSecs / (dist.meters / 1000) : 0;
      return {
        label: dist.label,
        meters: dist.meters,
        timeFormatted: formatTime(predictedSecs),
        paceFormatted: formatPace(paceSecs),
        speedKmh: (paceSecondsToKmh(paceSecs)).toFixed(1),
      };
    });
  }, [riegelDistanceMeters, totalRiegelTimeSeconds]);

  // Heart Rate Zones State
  const [maxHr, setMaxHr] = useState(185);
  const [restHr, setRestHr] = useState(52);

  const hrZones = useMemo(
    () => calculateHeartRateZones(maxHr, restHr),
    [maxHr, restHr]
  );

  // Converter State
  const [paceMins, setPaceMins] = useState(5);
  const [paceSecs, setPaceSecs] = useState(0);

  const converterPaceSecs = useMemo(
    () => paceMins * 60 + paceSecs,
    [paceMins, paceSecs]
  );

  const converterKmh = useMemo(
    () => (paceSecondsToKmh(converterPaceSecs)).toFixed(2),
    [converterPaceSecs]
  );

  const converterPaceMile = useMemo(() => {
    if (converterPaceSecs <= 0) return "--:--";
    const secPerMile = converterPaceSecs * 1.60934;
    return formatPace(secPerMile);
  }, [converterPaceSecs]);

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Page Title */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
            <Calculator className="size-5" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Calculadoras de Running
          </h1>
        </div>
        <p className="text-sm text-slate-400">
          Herramientas matemáticas para estimar ritmos de entrenamiento (VDOT), pronosticar marcas y calcular zonas cardíacas.
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <TabsTrigger
            value="vdot"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-semibold rounded-lg text-xs md:text-sm"
          >
            <Sparkles className="size-4 shrink-0" />
            <span>VDOT & Ritmos</span>
          </TabsTrigger>
          <TabsTrigger
            value="riegel"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-semibold rounded-lg text-xs md:text-sm"
          >
            <Trophy className="size-4 shrink-0" />
            <span>Predictor</span>
          </TabsTrigger>
          <TabsTrigger
            value="hr"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-semibold rounded-lg text-xs md:text-sm"
          >
            <HeartPulse className="size-4 shrink-0" />
            <span>Zonas FC</span>
          </TabsTrigger>
          <TabsTrigger
            value="converter"
            className="flex items-center gap-2 data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 font-semibold rounded-lg text-xs md:text-sm"
          >
            <ArrowRightLeft className="size-4 shrink-0" />
            <span>Conversor</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: VDOT & Ritmos ── */}
        <TabsContent value="vdot" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Column */}
            <Card className="lg:col-span-5 bg-slate-900/90 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-400">
                  <Flame className="size-5" />
                  Rendimiento Reciente
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Ingresá el tiempo de tu mejor marca reciente para obtener tu VDOT (Jack Daniels) y ritmos exactos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vdot-dist" className="text-xs font-semibold text-slate-300">
                    Distancia de la marca
                  </Label>
                  <select
                    id="vdot-dist"
                    value={vdotDistanceMeters}
                    onChange={(e) => setVdotDistanceMeters(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {STANDARD_DISTANCES.map((d) => (
                      <option key={d.meters} value={d.meters}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-300">
                    Tiempo Logrado (Horas : Minutos : Segundos)
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Horas</span>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        value={vdotHours}
                        onChange={(e) => setVdotHours(Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-slate-950 border-slate-800 text-white font-mono text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Minutos</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={vdotMinutes}
                        onChange={(e) => setVdotMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-slate-950 border-slate-800 text-white font-mono text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Segundos</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={vdotSeconds}
                        onChange={(e) => setVdotSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-slate-950 border-slate-800 text-white font-mono text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between mt-4">
                  <div>
                    <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">
                      Puntaje VDOT Estimado
                    </span>
                    <div className="text-3xl font-black text-emerald-400 tracking-tight">
                      {calculatedVdot > 0 ? calculatedVdot : "--"}
                    </div>
                  </div>
                  <Sparkles className="size-8 text-emerald-500/40" />
                </div>
              </CardContent>
            </Card>

            {/* Results Column */}
            <Card className="lg:col-span-7 bg-slate-900/90 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
                  <span>Ritmos de Entrenamiento Sugeridos</span>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                    VDOT {calculatedVdot}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Rangos de ritmo por kilómetro basados en la metodología de Jack Daniels para optimizar cada sesión.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Easy / Rodaje Suave (Z2)
                    </div>
                    <p className="text-[11px] text-slate-400">Desarrollo aeróbico base y recuperación.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-mono text-white">
                      {trainingPaces.easyMin} – {trainingPaces.easyMax}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">min/km</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-teal-400 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-teal-500" />
                      Marathon / Maratón (M)
                    </div>
                    <p className="text-[11px] text-slate-400">Ritmo objetivo sostenido para 42K.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-mono text-white">
                      {trainingPaces.marathon}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">min/km</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500" />
                      Threshold / Umbral Lactato (T)
                    </div>
                    <p className="text-[11px] text-slate-400">Ritmo de tempo cómodo pero controlado.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-mono text-white">
                      {trainingPaces.threshold}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">min/km</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-orange-500" />
                      Interval / Series VO2 Max (I)
                    </div>
                    <p className="text-[11px] text-slate-400">Series duras de 3 a 5 minutos (98-100% FC máx).</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-mono text-white">
                      {trainingPaces.interval}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">min/km</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-rose-500" />
                      Repetition / Velocidad (R)
                    </div>
                    <p className="text-[11px] text-slate-400">Repeticiones cortas (200m - 400m) para economía de carrera.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-mono text-white">
                      {trainingPaces.repetition}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">min/km</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 2: Predictor de Carrera ── */}
        <TabsContent value="riegel" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 bg-slate-900/90 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-400">
                  <Trophy className="size-5" />
                  Carrera de Referencia
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Utilizá una carrera reciente para proyectar tiempos en otras distancias competitivas (Fórmula de Riegel).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="riegel-dist" className="text-xs font-semibold text-slate-300">
                    Distancia base
                  </Label>
                  <select
                    id="riegel-dist"
                    value={riegelDistanceMeters}
                    onChange={(e) => setRiegelDistanceMeters(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {STANDARD_DISTANCES.map((d) => (
                      <option key={d.meters} value={d.meters}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-300">
                    Tiempo Realizado
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Horas</span>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        value={riegelHours}
                        onChange={(e) => setRiegelHours(Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-slate-950 border-slate-800 text-white font-mono text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Minutos</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={riegelMinutes}
                        onChange={(e) => setRiegelMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-slate-950 border-slate-800 text-white font-mono text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Segundos</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={riegelSeconds}
                        onChange={(e) => setRiegelSeconds(Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-slate-950 border-slate-800 text-white font-mono text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
                  <Info className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Fórmula de Peter Riegel ($T_2 = T_1 \times (D_2 / D_1)^{1.06}$), asume una preparación aeróbica adecuada para la distancia proyectada.
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 bg-slate-900/90 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">
                  Proyecciones Equivalentes
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Tiempos objetivo estimados para distancias estándar de carrera.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {riegelProjections.map((proj) => (
                  <div
                    key={proj.meters}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <span className="text-sm font-bold text-white block">
                        {proj.label}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {proj.speedKmh} km/h
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black font-mono text-emerald-400">
                        {proj.timeFormatted}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {proj.paceFormatted} min/km
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 3: Zonas de Frecuencia Cardíaca ── */}
        <TabsContent value="hr" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 bg-slate-900/90 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-400">
                  <HeartPulse className="size-5" />
                  Parámetros Cardíacos
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Configurá tu FC máxima y de reposo para calcular tus 5 zonas según la fórmula de Karvonen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="max-hr" className="text-xs font-semibold text-slate-300">
                    Frecuencia Cardíaca Máxima (bpm)
                  </Label>
                  <Input
                    id="max-hr"
                    type="number"
                    min="100"
                    max="230"
                    value={maxHr}
                    onChange={(e) => setMaxHr(parseInt(e.target.value) || 180)}
                    className="bg-slate-950 border-slate-800 text-white font-mono text-lg font-bold"
                  />
                  <p className="text-[11px] text-slate-400">
                    Sugerencia: Medida en un test de esfuerzo o serie de sprint agudo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rest-hr" className="text-xs font-semibold text-slate-300">
                    Frecuencia Cardíaca en Reposo (bpm)
                  </Label>
                  <Input
                    id="rest-hr"
                    type="number"
                    min="30"
                    max="100"
                    value={restHr}
                    onChange={(e) => setRestHr(parseInt(e.target.value) || 0)}
                    className="bg-slate-950 border-slate-800 text-white font-mono text-lg font-bold"
                  />
                  <p className="text-[11px] text-slate-400">
                    Medida al despertar (dejar en 0 para cálculo estándar por FC máx).
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 bg-slate-900/90 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">
                  Tus 5 Zonas de Frecuencia Cardíaca
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Utilizá estas zonas para controlar la intensidad durante los rodajes y series.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Z1 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-teal-400 uppercase tracking-wide block">
                      Z1 · Recuperación Activa (50-60%)
                    </span>
                    <span className="text-xs text-slate-400">Trote suave de regeneración y calentamiento.</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-white">
                      {hrZones.z1Recovery[0]} – {hrZones.z1Recovery[1]}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">bpm</span>
                  </div>
                </div>

                {/* Z2 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide block">
                      Z2 · Aeróbico / Rodaje Base (60-70%)
                    </span>
                    <span className="text-xs text-slate-400">Zona principal de construcción aeróbica y quemagrasa.</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-emerald-400">
                      {hrZones.z2Aerobic[0]} – {hrZones.z2Aerobic[1]}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">bpm</span>
                  </div>
                </div>

                {/* Z3 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wide block">
                      Z3 · Tempo / Ritmo Maratón (70-80%)
                    </span>
                    <span className="text-xs text-slate-400">Desarrollo de eficiencia cardiovascular sostenida.</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-white">
                      {hrZones.z3Tempo[0]} – {hrZones.z3Tempo[1]}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">bpm</span>
                  </div>
                </div>

                {/* Z4 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wide block">
                      Z4 · Umbral Lactato (80-90%)
                    </span>
                    <span className="text-xs text-slate-400">Ritmo de carrera 10K / 21K duro. Tolerancia al lactato.</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-white">
                      {hrZones.z4Threshold[0]} – {hrZones.z4Threshold[1]}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">bpm</span>
                  </div>
                </div>

                {/* Z5 */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-rose-400 uppercase tracking-wide block">
                      Z5 · Anaeróbico / VO2 Max (90-100%)
                    </span>
                    <span className="text-xs text-slate-400">Esfuerzo máximo en series cortas y sprints finales.</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-white">
                      {hrZones.z5Anaerobic[0]} – {hrZones.z5Anaerobic[1]}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">bpm</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 4: Conversor de Ritmo & Velocidad ── */}
        <TabsContent value="converter" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 bg-slate-900/90 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-emerald-400">
                  <Gauge className="size-5" />
                  Conversor Bidireccional
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Ingresá el ritmo en min/km para obtener la velocidad en km/h y ritmo por milla.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-300">
                    Ritmo (Minutos : Segundos por KM)
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Minutos</span>
                      <Input
                        type="number"
                        min="2"
                        max="20"
                        value={paceMins}
                        onChange={(e) => setPaceMins(Math.max(1, parseInt(e.target.value) || 0))}
                        className="bg-slate-950 border-slate-800 text-white font-mono text-center text-lg font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Segundos</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={paceSecs}
                        onChange={(e) => setPaceSecs(Math.max(0, parseInt(e.target.value) || 0))}
                        className="bg-slate-950 border-slate-800 text-white font-mono text-center text-lg font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Velocidad
                    </span>
                    <span className="text-2xl font-black font-mono text-emerald-400">
                      {converterKmh}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">km/h</span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Ritmo Milla
                    </span>
                    <span className="text-2xl font-black font-mono text-emerald-400">
                      {converterPaceMile}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-medium">min/mi</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 bg-slate-900/90 border-slate-800 text-slate-100">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">
                  Tabla de Referencia Rápida
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Equivalencias habituales entre ritmos de paso (min/km) y velocidad de cinta/reloj (km/h).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300 font-mono">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Ritmo (min/km)</th>
                        <th className="py-2.5 px-3">Velocidad (km/h)</th>
                        <th className="py-2.5 px-3">Ritmo Milla (min/mi)</th>
                        <th className="py-2.5 px-3">5K Time</th>
                        <th className="py-2.5 px-3">10K Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                      {[
                        { min: 3, sec: 30 },
                        { min: 4, sec: 0 },
                        { min: 4, sec: 30 },
                        { min: 5, sec: 0 },
                        { min: 5, sec: 30 },
                        { min: 6, sec: 0 },
                        { min: 6, sec: 30 },
                      ].map((row) => {
                        const secPerKm = row.min * 60 + row.sec;
                        const kmh = (paceSecondsToKmh(secPerKm)).toFixed(1);
                        const milePace = formatPace(secPerKm * 1.60934);
                        const t5k = formatTime(secPerKm * 5);
                        const t10k = formatTime(secPerKm * 10);
                        return (
                          <tr key={secPerKm} className="hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-bold text-emerald-400">
                              {formatPace(secPerKm)}
                            </td>
                            <td className="py-2.5 px-3 text-white">{kmh} km/h</td>
                            <td className="py-2.5 px-3 text-slate-400">{milePace}</td>
                            <td className="py-2.5 px-3 text-slate-400">{t5k}</td>
                            <td className="py-2.5 px-3 text-slate-400">{t10k}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

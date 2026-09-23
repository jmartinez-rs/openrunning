import { createFileRoute } from "@tanstack/react-router"
import {
  ArrowRightLeft,
  Calculator,
  Flame,
  Gauge,
  HeartPulse,
  Info,
  Sparkles,
  Trophy,
} from "lucide-react"
import { useMemo, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  calculateHeartRateZones,
  calculateVDOT,
  formatPace,
  formatTime,
  getTrainingPaces,
  paceSecondsToKmh,
  predictTimeRiegel,
} from "@/lib/running-math"

export const Route = createFileRoute("/_layout/tools")({
  component: ToolsView,
  head: () => ({
    meta: [{ title: "Calculadoras de Running - OpenRunning" }],
  }),
})

const STANDARD_DISTANCES = [
  { label: "5K (5.0 km)", meters: 5000 },
  { label: "10K (10.0 km)", meters: 10000 },
  { label: "15K (15.0 km)", meters: 15000 },
  { label: "21.1K (Media Maratón)", meters: 21097 },
  { label: "42.2K (Maratón)", meters: 42195 },
]

function ToolsView() {
  const [activeTab, setActiveTab] = useState("vdot")

  // VDOT Calculator State
  const [vdotDistanceMeters, setVdotDistanceMeters] = useState(10000)
  const [vdotHours, setVdotHours] = useState(0)
  const [vdotMinutes, setVdotMinutes] = useState(48)
  const [vdotSeconds, setVdotSeconds] = useState(30)

  const totalVdotTimeSeconds = useMemo(
    () => vdotHours * 3600 + vdotMinutes * 60 + vdotSeconds,
    [vdotHours, vdotMinutes, vdotSeconds],
  )

  const calculatedVdot = useMemo(
    () => calculateVDOT(vdotDistanceMeters, totalVdotTimeSeconds),
    [vdotDistanceMeters, totalVdotTimeSeconds],
  )

  const trainingPaces = useMemo(
    () => getTrainingPaces(calculatedVdot),
    [calculatedVdot],
  )

  // Riegel Predictor State
  const [riegelDistanceMeters, setRiegelDistanceMeters] = useState(10000)
  const [riegelHours, setRiegelHours] = useState(0)
  const [riegelMinutes, setRiegelMinutes] = useState(48)
  const [riegelSeconds, setRiegelSeconds] = useState(30)

  const totalRiegelTimeSeconds = useMemo(
    () => riegelHours * 3600 + riegelMinutes * 60 + riegelSeconds,
    [riegelHours, riegelMinutes, riegelSeconds],
  )

  const riegelProjections = useMemo(() => {
    return STANDARD_DISTANCES.map((dist) => {
      const predictedSecs = predictTimeRiegel(
        riegelDistanceMeters,
        totalRiegelTimeSeconds,
        dist.meters,
      )
      const paceSecs =
        predictedSecs > 0 ? predictedSecs / (dist.meters / 1000) : 0
      return {
        label: dist.label,
        meters: dist.meters,
        timeFormatted: formatTime(predictedSecs),
        paceFormatted: formatPace(paceSecs),
        speedKmh: paceSecondsToKmh(paceSecs).toFixed(1),
      }
    })
  }, [riegelDistanceMeters, totalRiegelTimeSeconds])

  // Heart Rate Zones State
  const [maxHr, setMaxHr] = useState(185)
  const [restHr, setRestHr] = useState(52)

  const hrZones = useMemo(
    () => calculateHeartRateZones(maxHr, restHr),
    [maxHr, restHr],
  )

  // Converter State
  const [paceMins, setPaceMins] = useState(5)
  const [paceSecs, setPaceSecs] = useState(0)

  const converterPaceSecs = useMemo(
    () => paceMins * 60 + paceSecs,
    [paceMins, paceSecs],
  )

  const converterKmh = useMemo(
    () => paceSecondsToKmh(converterPaceSecs).toFixed(2),
    [converterPaceSecs],
  )

  const converterPaceMile = useMemo(() => {
    if (converterPaceSecs <= 0) return "--:--"
    const secPerMile = converterPaceSecs * 1.60934
    return formatPace(secPerMile)
  }, [converterPaceSecs])

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Page Title */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calculator className="size-5" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Calculadoras de Running
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Herramientas matemáticas para estimar ritmos de entrenamiento (VDOT),
          pronosticar marcas y calcular zonas cardíacas.
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 bg-card border border-border p-1 rounded-xl h-auto">
          <TabsTrigger
            value="vdot"
            className="flex items-center gap-2 bg-surface-container-lowest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-lg text-xs md:text-sm"
          >
            <Sparkles className="size-4 shrink-0" />
            <span>VDOT & Ritmos</span>
          </TabsTrigger>
          <TabsTrigger
            value="riegel"
            className="flex items-center gap-2 bg-surface-container-lowest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-lg text-xs md:text-sm"
          >
            <Trophy className="size-4 shrink-0" />
            <span>Predictor</span>
          </TabsTrigger>
          <TabsTrigger
            value="hr"
            className="flex items-center gap-2 bg-surface-container-lowest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-lg text-xs md:text-sm"
          >
            <HeartPulse className="size-4 shrink-0" />
            <span>Zonas FC</span>
          </TabsTrigger>
          <TabsTrigger
            value="converter"
            className="flex items-center gap-2 bg-surface-container-lowest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold rounded-lg text-xs md:text-sm"
          >
            <ArrowRightLeft className="size-4 shrink-0" />
            <span>Conversor</span>
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: VDOT & Ritmos ── */}
        <TabsContent value="vdot" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Column */}
            <Card className="lg:col-span-5 bg-card/90 border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                  <Flame className="size-5" />
                  Rendimiento Reciente
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Ingresá el tiempo de tu mejor marca reciente para obtener tu
                  VDOT (Jack Daniels) y ritmos exactos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="vdot-dist"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Distancia de la marca
                  </Label>
                  <Select
                    value={String(vdotDistanceMeters)}
                    onValueChange={(v) => setVdotDistanceMeters(Number(v))}
                  >
                    <SelectTrigger
                      id="vdot-dist"
                      className="w-full bg-background border-border text-white"
                    >
                      <SelectValue placeholder="Seleccioná una distancia" />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_DISTANCES.map((d) => (
                        <SelectItem key={d.meters} value={String(d.meters)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Tiempo Logrado (Horas : Minutos : Segundos)
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        Horas
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        value={vdotHours}
                        onChange={(e) =>
                          setVdotHours(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        className="bg-background border-border text-white font-display text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        Minutos
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={vdotMinutes}
                        onChange={(e) =>
                          setVdotMinutes(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        className="bg-background border-border text-white font-display text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        Segundos
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={vdotSeconds}
                        onChange={(e) =>
                          setVdotSeconds(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        className="bg-background border-border text-white font-display text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-lowest border border-border flex items-center justify-between mt-4">
                  <div>
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">
                      Puntaje VDOT Estimado
                    </span>
                    <div className="text-3xl font-black text-primary tracking-tight">
                      {calculatedVdot > 0 ? calculatedVdot : "--"}
                    </div>
                  </div>
                  <Sparkles className="size-8 text-primary/40" />
                </div>
              </CardContent>
            </Card>

            {/* Results Column */}
            <Card className="lg:col-span-7 bg-card/90 border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white flex items-center justify-between">
                  <span>Ritmos de Entrenamiento Sugeridos</span>
                  <span className="text-xs font-display text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                    VDOT {calculatedVdot}
                  </span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Rangos de ritmo por kilómetro basados en la metodología de
                  Jack Daniels para optimizar cada sesión.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#4d5a1a] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#4d5a1a]" />
                      Easy / Rodaje Suave (Z2)
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Desarrollo aeróbico base y recuperación.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-display text-white">
                      {trainingPaces.easyMin} – {trainingPaces.easyMax}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      min/km
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#6a8220] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#6a8220]" />
                      Marathon / Maratón (M)
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Ritmo objetivo sostenido para 42K.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-display text-white">
                      {trainingPaces.marathon}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      min/km
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#a9cc33] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#a9cc33]" />
                      Threshold / Umbral Lactato (T)
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Ritmo de tempo cómodo pero controlado.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-display text-white">
                      {trainingPaces.threshold}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      min/km
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#EAFC5F] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#EAFC5F]" />
                      Interval / Series VO2 Max (I)
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Series duras de 3 a 5 minutos (98-100% FC máx).
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-display text-white">
                      {trainingPaces.interval}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      min/km
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border/80 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-[#EF4444] flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#EF4444]" />
                      Repetition / Velocidad (R)
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Repeticiones cortas (200m - 400m) para economía de
                      carrera.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black font-display text-white">
                      {trainingPaces.repetition}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      min/km
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 2: Predictor de Carrera ── */}
        <TabsContent value="riegel" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 bg-card/90 border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                  <Trophy className="size-5" />
                  Carrera de Referencia
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Utilizá una carrera reciente para proyectar tiempos en otras
                  distancias competitivas (Fórmula de Riegel).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="riegel-dist"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Distancia base
                  </Label>
                  <Select
                    value={String(riegelDistanceMeters)}
                    onValueChange={(v) => setRiegelDistanceMeters(Number(v))}
                  >
                    <SelectTrigger
                      id="riegel-dist"
                      className="w-full bg-background border-border text-white"
                    >
                      <SelectValue placeholder="Seleccioná una distancia" />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_DISTANCES.map((d) => (
                        <SelectItem key={d.meters} value={String(d.meters)}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Tiempo Realizado
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        Horas
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        value={riegelHours}
                        onChange={(e) =>
                          setRiegelHours(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        className="bg-background border-border text-white font-display text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        Minutos
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={riegelMinutes}
                        onChange={(e) =>
                          setRiegelMinutes(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        className="bg-background border-border text-white font-display text-center"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        Segundos
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={riegelSeconds}
                        onChange={(e) =>
                          setRiegelSeconds(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        className="bg-background border-border text-white font-display text-center"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-background/60 border border-border text-xs text-muted-foreground flex items-start gap-2.5">
                  <Info className="size-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    Fórmula de Peter Riegel ($T_2 = T_1 \times (D_2 / D_1)^
                    {1.06}$), asume una preparación aeróbica adecuada para la
                    distancia proyectada.
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 bg-card/90 border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">
                  Proyecciones Equivalentes
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Tiempos objetivo estimados para distancias estándar de
                  carrera.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {riegelProjections.map((proj) => (
                  <div
                    key={proj.meters}
                    className="p-3.5 rounded-xl bg-surface-container-lowest border border-border flex items-center justify-between hover:border-border transition-colors"
                  >
                    <div>
                      <span className="text-sm font-bold text-white block">
                        {proj.label}
                      </span>
                      <span className="text-xs text-muted-foreground font-display">
                        {proj.speedKmh} km/h
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black font-display text-primary">
                        {proj.timeFormatted}
                      </div>
                      <div className="text-xs text-muted-foreground font-display">
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
            <Card className="lg:col-span-5 bg-card/90 border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                  <HeartPulse className="size-5" />
                  Parámetros Cardíacos
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Configurá tu FC máxima y de reposo para calcular tus 5 zonas
                  según la fórmula de Karvonen.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="max-hr"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Frecuencia Cardíaca Máxima (bpm)
                  </Label>
                  <Input
                    id="max-hr"
                    type="number"
                    min="100"
                    max="230"
                    value={maxHr}
                    onChange={(e) =>
                      setMaxHr(parseInt(e.target.value, 10) || 180)
                    }
                    className="bg-background border-border text-white font-display text-lg font-bold"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Sugerencia: Medida en un test de esfuerzo o serie de sprint
                    agudo.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="rest-hr"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Frecuencia Cardíaca en Reposo (bpm)
                  </Label>
                  <Input
                    id="rest-hr"
                    type="number"
                    min="30"
                    max="100"
                    value={restHr}
                    onChange={(e) =>
                      setRestHr(parseInt(e.target.value, 10) || 0)
                    }
                    className="bg-background border-border text-white font-display text-lg font-bold"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Medida al despertar (dejar en 0 para cálculo estándar por FC
                    máx).
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 bg-card/90 border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">
                  Tus 5 Zonas de Frecuencia Cardíaca
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Utilizá estas zonas para controlar la intensidad durante los
                  rodajes y series.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Z1 */}
                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#6a8220] uppercase tracking-wide block">
                      Z1 · Recuperación Activa (50-60%)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Trote suave de regeneración y calentamiento.
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-display text-white">
                      {hrZones.z1Recovery[0]} – {hrZones.z1Recovery[1]}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      bpm
                    </span>
                  </div>
                </div>

                {/* Z2 */}
                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-primary/30 bg-primary/5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#4d5a1a] uppercase tracking-wide block">
                      Z2 · Aeróbico / Rodaje Base (60-70%)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Zona principal de construcción aeróbica y quemagrasa.
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-display text-primary">
                      {hrZones.z2Aerobic[0]} – {hrZones.z2Aerobic[1]}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      bpm
                    </span>
                  </div>
                </div>

                {/* Z3 */}
                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#a9cc33] uppercase tracking-wide block">
                      Z3 · Tempo / Ritmo Maratón (70-80%)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Desarrollo de eficiencia cardiovascular sostenida.
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-display text-white">
                      {hrZones.z3Tempo[0]} – {hrZones.z3Tempo[1]}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      bpm
                    </span>
                  </div>
                </div>

                {/* Z4 */}
                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#EAFC5F] uppercase tracking-wide block">
                      Z4 · Umbral Lactato (80-90%)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Ritmo de carrera 10K / 21K duro. Tolerancia al lactato.
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-display text-white">
                      {hrZones.z4Threshold[0]} – {hrZones.z4Threshold[1]}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      bpm
                    </span>
                  </div>
                </div>

                {/* Z5 */}
                <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-[#EF4444] uppercase tracking-wide block">
                      Z5 · Anaeróbico / VO2 Max (90-100%)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Esfuerzo máximo en series cortas y sprints finales.
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-display text-white">
                      {hrZones.z5Anaerobic[0]} – {hrZones.z5Anaerobic[1]}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      bpm
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TAB 4: Conversor de Ritmo & Velocidad ── */}
        <TabsContent value="converter" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 bg-card/90 border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-primary">
                  <Gauge className="size-5" />
                  Conversor Bidireccional
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Ingresá el ritmo en min/km para obtener la velocidad en km/h y
                  ritmo por milla.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground">
                    Ritmo (Minutos : Segundos por KM)
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        Minutos
                      </span>
                      <Input
                        type="number"
                        min="2"
                        max="20"
                        value={paceMins}
                        onChange={(e) =>
                          setPaceMins(
                            Math.max(1, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        className="bg-background border-border text-white font-display text-center text-lg font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-bold">
                        Segundos
                      </span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={paceSecs}
                        onChange={(e) =>
                          setPaceSecs(
                            Math.max(0, parseInt(e.target.value, 10) || 0),
                          )
                        }
                        className="bg-background border-border text-white font-display text-center text-lg font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Velocidad
                    </span>
                    <span className="text-2xl font-black font-display text-primary">
                      {converterKmh}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      km/h
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                      Ritmo Milla
                    </span>
                    <span className="text-2xl font-black font-display text-primary">
                      {converterPaceMile}
                    </span>
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      min/mi
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 bg-card/90 border-border text-foreground">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">
                  Tabla de Referencia Rápida
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Equivalencias habituales entre ritmos de paso (min/km) y
                  velocidad de cinta/reloj (km/h).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-muted-foreground font-display">
                    <thead className="bg-surface-container-lowest text-muted-foreground uppercase text-[10px] border-b border-border">
                      <tr>
                        <th className="py-2.5 px-3">Ritmo (min/km)</th>
                        <th className="py-2.5 px-3">Velocidad (km/h)</th>
                        <th className="py-2.5 px-3">Ritmo Milla (min/mi)</th>
                        <th className="py-2.5 px-3">5K Time</th>
                        <th className="py-2.5 px-3">10K Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 bg-background/40">
                      {[
                        { min: 3, sec: 30 },
                        { min: 4, sec: 0 },
                        { min: 4, sec: 30 },
                        { min: 5, sec: 0 },
                        { min: 5, sec: 30 },
                        { min: 6, sec: 0 },
                        { min: 6, sec: 30 },
                      ].map((row) => {
                        const secPerKm = row.min * 60 + row.sec
                        const kmh = paceSecondsToKmh(secPerKm).toFixed(1)
                        const milePace = formatPace(secPerKm * 1.60934)
                        const t5k = formatTime(secPerKm * 5)
                        const t10k = formatTime(secPerKm * 10)
                        return (
                          <tr
                            key={secPerKm}
                            className="hover:bg-surface-container-high/40"
                          >
                            <td className="py-2.5 px-3 font-bold text-primary">
                              {formatPace(secPerKm)}
                            </td>
                            <td className="py-2.5 px-3 text-white">
                              {kmh} km/h
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {milePace}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {t5k}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {t10k}
                            </td>
                          </tr>
                        )
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
  )
}

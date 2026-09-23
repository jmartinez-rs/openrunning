import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flag,
  Footprints,
  Gauge,
  ImagePlus,
  Loader2,
  Navigation,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  ActivitiesService,
  type ApiError,
  RacesService,
  ShoesService,
  StorageService,
} from "@/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import { parseRaceNotes, type RaceMeta, stringifyRaceNotes } from "./race-meta"
import { parseRaceTime, secondsToTimeInput } from "./race-utils"

interface RaceWizardProps {
  editId?: string | null
  defaultActivityId?: string | null
}

const RACE_STEPS = [
  {
    id: 1,
    title: "1. Datos del Evento",
    desc: "Nombre, distancia y fecha",
    icon: Flag,
  },
  {
    id: 2,
    title: "2. Prioridad y Plan",
    desc: "Importancia y vinculación",
    icon: Trophy,
  },
  {
    id: 3,
    title: "3. Objetivos",
    desc: "Marca, ritmos y zapatillas",
    icon: Target,
  },
  {
    id: 4,
    title: "4. Logística",
    desc: "Largada, dorsal y nutrición",
    icon: Navigation,
  },
  {
    id: 5,
    title: "5. Resultados",
    desc: "Tiempos, Strava y fotos",
    icon: Sparkles,
  },
] as const

const DISTANCE_PRESETS = [
  { label: "5K", km: "5" },
  { label: "10K", km: "10" },
  { label: "15K", km: "15" },
  { label: "21.1K (Media)", km: "21.1" },
  { label: "42.2K (Maratón)", km: "42.2" },
  { label: "50K (Ultra)", km: "50" },
]

const SURFACE_OPTIONS = [
  {
    id: "calle",
    title: "Calle / Asfalto",
    desc: "Circuito urbano o pavimento regular",
    icon: Footprints,
  },
  {
    id: "pista",
    title: "Pista",
    desc: "Tartán sintético o pista de atletismo",
    icon: Gauge,
  },
  {
    id: "trail",
    title: "Trail / Montaña",
    desc: "Senderos técnicos, ripio o desnivel",
    icon: Compass,
  },
  {
    id: "mixto",
    title: "Mixto",
    desc: "Combinación de asfalto y caminos rurales",
    icon: Navigation,
  },
] as const

const ELEVATION_OPTIONS = [
  {
    id: "plano",
    title: "Plano",
    desc: "Rápido y homogéneo, perfecto para marcas personales",
  },
  {
    id: "ondulado",
    title: "Ondulado",
    desc: "Falsos llanos y repechos suaves continuos",
  },
  {
    id: "subidas",
    title: "Subidas Pronunciadas",
    desc: "Gran desnivel acumulado o pendientes fuertes",
  },
] as const

const PRIORITY_OPTIONS = [
  {
    id: "A",
    badge: "Prioridad A",
    badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    title: "🥇 Objetivo Principal",
    desc: "El evento más relevante de tu temporada. Tu ciclo de carga y descarga (tapering) giran en torno a este día.",
  },
  {
    id: "B",
    badge: "Prioridad B",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    title: "🥈 Preparatoria / Tune-up",
    desc: "Prueba intermedia a ritmo competitivo. Testeo de zapatillas, suplementación y sensaciones reales.",
  },
  {
    id: "C",
    badge: "Prioridad C",
    badgeColor: "bg-zinc-500/20 text-zinc-300 border-zinc-500/40",
    title: "🥉 Recreativa / Fondo",
    desc: "Carrera social o entrenamiento con dorsal. Sin descarga previa ni presión de reloj.",
  },
  {
    id: "",
    badge: "Sin Prioridad",
    badgeColor: "bg-surface-container-high text-muted-foreground border-border",
    title: "⚪ Estándar",
    desc: "Evento casual sin categorización específica.",
  },
] as const

const STATUS_OPTIONS = [
  { id: "", label: "Desconocido / No especificado" },
  { id: "confirmed", label: "Inscripción confirmada" },
  { id: "pending_payment", label: "Pago pendiente" },
  { id: "pending_kit", label: "Retiro de kit pendiente" },
]

const fieldInputClass =
  "bg-surface-container-high/80 border-border text-white placeholder:text-muted-foreground focus-visible:ring-primary/50 focus-visible:border-primary rounded-xl text-sm"
const fieldSelectClass =
  "w-full rounded-xl border border-border bg-surface-container-high/80 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
const fieldTextareaClass =
  "w-full rounded-xl border border-border bg-surface-container-high/80 p-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"

export function RaceWizard({ editId, defaultActivityId }: RaceWizardProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [step, setStep] = useState(1)

  // Form State
  const [eventName, setEventName] = useState("")
  const [distanceKm, setDistanceKm] = useState("")
  const [date, setDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [location, setLocation] = useState("")
  const [surfaceType, setSurfaceType] = useState<RaceMeta["surface_type"]>("")
  const [elevationProfile, setElevationProfile] =
    useState<RaceMeta["elevation_profile"]>("")

  const [priority, setPriority] = useState<RaceMeta["priority"]>("")
  const [linkToPlan, setLinkToPlan] = useState(false)

  const [goalType, setGoalType] = useState<RaceMeta["goal_type"]>("")
  const [targetTime, setTargetTime] = useState("")
  const [targetPace, setTargetPace] = useState("")
  const [shoeId, setShoeId] = useState("")

  const [bibNumber, setBibNumber] = useState("")
  const [corral, setCorral] = useState("")
  const [kitRetrievalInfo, setKitRetrievalInfo] = useState("")
  const [webLink, setWebLink] = useState("")
  const [status, setStatus] = useState<RaceMeta["status"]>("")
  const [splitsStrategy, setSplitsStrategy] = useState("")
  const [nutritionPlan, setNutritionPlan] = useState("")

  const [officialTime, setOfficialTime] = useState("")
  const [chipTime, setChipTime] = useState("")
  const [position, setPosition] = useState("")
  const [category, setCategory] = useState("")
  const [activityId, setActivityId] = useState(defaultActivityId ?? "")
  const [notes, setNotes] = useState("")
  const [photos, setPhotos] = useState<string[]>([])

  const [uploading, setUploading] = useState(false)
  const userPickedShoe = useRef(false)
  const hasInitialized = useRef(false)

  // Fetch queries
  const editQuery = useQuery({
    queryKey: ["race", editId],
    queryFn: () => RacesService.readRace({ raceId: editId! }),
    enabled: Boolean(editId),
  })

  const activityDefaultQuery = useQuery({
    queryKey: ["activity", defaultActivityId],
    queryFn: () =>
      ActivitiesService.readActivity({ activityId: defaultActivityId! }),
    enabled: Boolean(defaultActivityId && !editId),
  })

  const activitiesQuery = useQuery({
    queryKey: ["activities", "strava"],
    queryFn: () =>
      ActivitiesService.readActivities({ sourceType: "strava", limit: 100 }),
  })

  const shoesQuery = useQuery({
    queryKey: ["shoes"],
    queryFn: () => ShoesService.readShoes({ limit: 100 }),
  })

  // Populate state when edit race loads
  useEffect(() => {
    if (editQuery.data && !hasInitialized.current) {
      hasInitialized.current = true
      const race = editQuery.data
      const meta = parseRaceNotes(race.notes)

      setEventName(race.event_name ?? "")
      setDistanceKm(race.distance_km != null ? String(race.distance_km) : "")
      setDate(race.date ? race.date.slice(0, 10) : "")
      setLocation(race.location ?? "")
      setStartTime(meta.start_time ?? "")
      setSurfaceType(meta.surface_type ?? "")
      setElevationProfile(meta.elevation_profile ?? "")

      setPriority(meta.priority ?? "")

      setGoalType(meta.goal_type ?? "")
      setTargetTime(meta.target_time ?? "")
      setTargetPace(meta.target_pace ?? "")
      setShoeId(race.shoe_id ?? "")
      if (race.shoe_id) userPickedShoe.current = true

      setBibNumber(race.bib_number ?? "")
      setCorral(meta.corral ?? "")
      setKitRetrievalInfo(meta.kit_retrieval_info ?? "")
      setWebLink(meta.web_link ?? "")
      setStatus(meta.status ?? "")
      setSplitsStrategy(meta.splits_strategy ?? "")
      setNutritionPlan(meta.nutrition_plan ?? "")

      setOfficialTime(secondsToTimeInput(race.official_time_seconds))
      setChipTime(secondsToTimeInput(race.chip_time_seconds))
      setPosition(race.position != null ? String(race.position) : "")
      setCategory(race.category ?? "")
      setActivityId(race.activity_id ?? "")
      setNotes(meta.raw_notes ?? "")
      setPhotos(race.photos_urls ?? [])
    }
  }, [editQuery.data])

  // Populate state when defaultActivityId loads
  useEffect(() => {
    if (activityDefaultQuery.data && !editId && !hasInitialized.current) {
      hasInitialized.current = true
      const act = activityDefaultQuery.data
      setActivityId(act.id)
      if (!eventName && act.name) setEventName(act.name)
      if (!date && act.timestamp) setDate(act.timestamp.slice(0, 10))
      if (!distanceKm && act.cardio?.distance_meters) {
        setDistanceKm(
          (Math.round(act.cardio.distance_meters / 100) / 10).toString(),
        )
      }
      if (!shoeId && act.cardio?.shoe_id) {
        setShoeId(act.cardio.shoe_id)
      }
      if (!officialTime && act.duration_seconds) {
        setOfficialTime(secondsToTimeInput(act.duration_seconds))
      }
    }
  }, [
    activityDefaultQuery.data,
    editId,
    eventName,
    date,
    distanceKm,
    shoeId,
    officialTime,
  ])

  // Automatic target pace calculation
  useEffect(() => {
    if (targetTime && distanceKm && goalType === "tiempo") {
      const parts = targetTime.split(":")
      let seconds = 0
      if (parts.length === 3) {
        seconds =
          parseInt(parts[0], 10) * 3600 +
          parseInt(parts[1], 10) * 60 +
          parseInt(parts[2], 10)
      } else if (parts.length === 2) {
        seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)
      }

      const dist = parseFloat(distanceKm)
      if (dist > 0 && seconds > 0) {
        const paceSecs = Math.floor(seconds / dist)
        const pm = Math.floor(paceSecs / 60)
        const ps = paceSecs % 60
        setTargetPace(
          `${pm.toString().padStart(2, "0")}:${ps.toString().padStart(2, "0")}`,
        )
      }
    }
  }, [targetTime, distanceKm, goalType])

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        event_name: eventName.trim(),
        date: date
          ? new Date(`${date}T12:00:00`).toISOString()
          : new Date().toISOString(),
        distance_km: Number(distanceKm) || 0,
        location: location.trim() || null,
        official_time_seconds: parseRaceTime(officialTime),
        chip_time_seconds: parseRaceTime(chipTime),
        position: position ? Number(position) : null,
        category: category.trim() || null,
        bib_number: bibNumber.trim() || null,
        notes: stringifyRaceNotes({
          priority,
          status,
          corral: corral.trim() || undefined,
          start_time: startTime || undefined,
          target_pace: targetPace || undefined,
          target_time: targetTime || undefined,
          splits_strategy: splitsStrategy.trim() || undefined,
          nutrition_plan: nutritionPlan.trim() || undefined,
          raw_notes: notes.trim() || undefined,
          surface_type: surfaceType || undefined,
          elevation_profile: elevationProfile || undefined,
          goal_type: goalType || undefined,
          kit_retrieval_info: kitRetrievalInfo.trim() || undefined,
          web_link: webLink.trim() || undefined,
        }),
        activity_id: activityId || null,
        shoe_id: shoeId || null,
        photos_urls: photos,
      }
      if (editId) {
        return RacesService.updateRace({
          raceId: editId,
          requestBody: payload,
        })
      }
      return RacesService.createRace({ requestBody: payload })
    },
    onSuccess: (saved) => {
      showSuccessToast(editId ? "Carrera actualizada" : "Carrera registrada")
      queryClient.invalidateQueries({ queryKey: ["races"] })
      queryClient.invalidateQueries({ queryKey: ["race", editId] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["shoe-stats"] })
      if (saved?.id) {
        navigate({ to: "/races/$raceId", params: { raceId: saved.id } })
      } else {
        navigate({ to: "/races" })
      }
    },
    onError: handleError.bind(showErrorToast),
  })

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const result = await StorageService.uploadFile({
        formData: { file: file as unknown as string },
      })
      const url = String((result as Record<string, string>).url ?? "")
      if (url) setPhotos((prev) => [...prev, url])
    } catch (error) {
      handleError.bind(showErrorToast)(error as ApiError)
    } finally {
      setUploading(false)
    }
  }

  const canProceedStep1 = Boolean(eventName.trim() && distanceKm && date)

  if (editId && editQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4 py-8 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto py-2">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="bg-card border border-border text-muted-foreground hover:text-white hover:bg-surface-container-high rounded-xl"
            asChild
          >
            <Link to="/races">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {editId ? "Editar Carrera" : "Nueva Carrera"}
              </h1>
              <Badge className="bg-primary/15 text-primary border-primary/30 gap-1 text-[11px] font-bold">
                <Trophy className="size-3" /> Race Hub
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Estructura los detalles, metas y logística de tu evento.
            </p>
          </div>
        </div>

        {step === 5 && (
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canProceedStep1}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card shadow-primary/20 gap-2 rounded-xl cursor-pointer"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4 stroke-[3]" />
            )}
            <span>{editId ? "Guardar Cambios" : "Guardar Carrera"}</span>
          </Button>
        )}
      </div>

      {/* Step Indicator Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-b border-border pb-4">
        {RACE_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={cn(
              "flex flex-col gap-1 p-2.5 rounded-xl text-left border transition-all duration-200 cursor-pointer",
              step === s.id
                ? "border-primary/60 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40"
                : "border-border bg-card/80 text-muted-foreground hover:bg-surface-container-high hover:text-white",
            )}
          >
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "size-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  step === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-container-high text-muted-foreground border border-border",
                )}
              >
                {s.id}
              </span>
              {step > s.id && <Check className="size-3.5 text-primary" />}
            </div>
            <span className="font-bold text-xs truncate">{s.title}</span>
            <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
              {s.desc}
            </span>
          </button>
        ))}
      </div>

      {/* STEP 1: Datos del Evento */}
      {step === 1 && (
        <Card className="p-6 bg-card border-border shadow-card rounded-2xl">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Flag className="size-5 text-primary" />
              1. Datos del Evento
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            {/* Event Name */}
            <div className="flex flex-col gap-2">
              <Label className="font-semibold text-xs text-muted-foreground">
                Nombre de la Carrera <span className="text-primary">*</span>
              </Label>
              <Input
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Ej: Media Maratón de Buenos Aires, NB 15K, Maratón de Sevilla..."
                className={fieldInputClass}
              />
            </div>

            {/* Distance presets and input */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Label className="font-semibold text-xs text-muted-foreground">
                Distancia Oficial (km) <span className="text-primary">*</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {DISTANCE_PRESETS.map((preset) => (
                  <button
                    key={preset.km}
                    type="button"
                    onClick={() => setDistanceKm(preset.km)}
                    className={cn(
                      "px-4 py-2 rounded-xl border font-bold text-xs transition-all cursor-pointer",
                      distanceKm === preset.km
                        ? "bg-primary/20 text-primary border-primary/60 shadow-xs ring-1 ring-primary/40"
                        : "bg-surface-container-high/60 text-muted-foreground border-border hover:bg-surface-container-high hover:text-white",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  placeholder="O ingresa distancia personalizada (km)..."
                  className={cn("w-full sm:w-72", fieldInputClass)}
                />
                <span className="text-xs text-muted-foreground">km</span>
              </div>
            </div>

            {/* Date and Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border pt-4">
              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Fecha del Evento <span className="text-primary">*</span>
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={fieldInputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Ubicación / Ciudad
                </Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ej: Buenos Aires, Argentina"
                  className={fieldInputClass}
                />
              </div>
            </div>

            {/* Surface Type */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Label className="font-semibold text-xs text-muted-foreground">
                Tipo de Superficie
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {SURFACE_OPTIONS.map((opt) => {
                  const isSelected = surfaceType === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSurfaceType(isSelected ? "" : opt.id)}
                      className={cn(
                        "flex flex-col gap-2 p-4 rounded-xl border text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-primary/60 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40"
                          : "border-border bg-surface-container-high/40 text-muted-foreground hover:bg-surface-container-high hover:border-border",
                      )}
                    >
                      <opt.icon
                        className={cn(
                          "size-5",
                          isSelected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      <div>
                        <h4 className="font-bold text-sm text-white">
                          {opt.title}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Elevation Profile */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Label className="font-semibold text-xs text-muted-foreground">
                Perfil de Altimetría
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {ELEVATION_OPTIONS.map((opt) => {
                  const isSelected = elevationProfile === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setElevationProfile(isSelected ? "" : opt.id)
                      }
                      className={cn(
                        "flex flex-col gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-primary/60 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40"
                          : "border-border bg-surface-container-high/40 text-muted-foreground hover:bg-surface-container-high hover:border-border",
                      )}
                    >
                      <h4 className="font-bold text-sm text-white">
                        {opt.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {opt.desc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bottom Nav */}
            <div className="flex justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-border text-muted-foreground rounded-xl"
                asChild
              >
                <Link to="/races">Cancelar</Link>
              </Button>
              <Button
                type="button"
                disabled={!canProceedStep1}
                onClick={() => setStep(2)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
              >
                <span>Siguiente: Prioridad y Plan</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Prioridad y Plan */}
      {step === 2 && (
        <Card className="p-6 bg-card border-border shadow-card rounded-2xl">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Trophy className="size-5 text-primary" />
              2. Prioridad y Plan de Entrenamiento
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            {/* Priority selection cards */}
            <div className="flex flex-col gap-3">
              <Label className="font-semibold text-xs text-muted-foreground">
                ¿Qué prioridad tiene este evento en tu temporada?
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRIORITY_OPTIONS.map((opt) => {
                  const isSelected = priority === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPriority(opt.id as any)}
                      className={cn(
                        "flex flex-col gap-2 p-4 rounded-xl border text-left transition-all cursor-pointer",
                        isSelected
                          ? "border-primary/60 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40"
                          : "border-border bg-surface-container-high/40 text-muted-foreground hover:bg-surface-container-high hover:border-border",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold",
                            opt.badgeColor,
                          )}
                        >
                          {opt.badge}
                        </Badge>
                        {isSelected && (
                          <Check className="size-4 text-primary" />
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-white">
                        {opt.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {opt.desc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Link to plan */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Label className="font-semibold text-xs text-muted-foreground">
                Integración con Plan de Entrenamiento
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLinkToPlan(false)}
                  className={cn(
                    "flex flex-col gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer",
                    !linkToPlan
                      ? "border-primary/60 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40"
                      : "border-border bg-surface-container-high/40 text-muted-foreground hover:bg-surface-container-high",
                  )}
                >
                  <h4 className="font-bold text-sm text-white">
                    Sin plan asociado
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Guardar de forma autónoma en el Race Hub.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setLinkToPlan(true)}
                  className={cn(
                    "flex flex-col gap-1.5 p-4 rounded-xl border text-left transition-all cursor-pointer",
                    linkToPlan
                      ? "border-primary/60 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40"
                      : "border-border bg-surface-container-high/40 text-muted-foreground hover:bg-surface-container-high",
                  )}
                >
                  <h4 className="font-bold text-sm text-white">
                    Vincular con tu plan activo
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Ajustará las semanas previas y días de descarga (tapering).
                  </p>
                </button>
              </div>
            </div>

            {/* Bottom Nav */}
            <div className="flex justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-border text-muted-foreground rounded-xl"
                onClick={() => setStep(1)}
              >
                <ChevronLeft className="size-4 mr-1" /> Atrás
              </Button>
              <Button
                type="button"
                onClick={() => setStep(3)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
              >
                <span>Siguiente: Objetivos</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Objetivos */}
      {step === 3 && (
        <Card className="p-6 bg-card border-border shadow-card rounded-2xl">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Target className="size-5 text-primary" />
              3. Objetivos de Rendimiento
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            {/* Goal Type */}
            <div className="flex flex-col gap-3">
              <Label className="font-semibold text-xs text-muted-foreground">
                Tipo de Meta
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGoalType("completar")}
                  className={cn(
                    "flex flex-col gap-2 p-4 rounded-xl border text-left transition-all cursor-pointer",
                    goalType === "completar"
                      ? "border-primary/60 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40"
                      : "border-border bg-surface-container-high/40 text-muted-foreground hover:bg-surface-container-high",
                  )}
                >
                  <Footprints className="size-5 text-primary" />
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      Completar la Distancia
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cruzar la meta como finisher y disfrutar del recorrido sin
                      presión de tiempo.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGoalType("tiempo")}
                  className={cn(
                    "flex flex-col gap-2 p-4 rounded-xl border text-left transition-all cursor-pointer",
                    goalType === "tiempo"
                      ? "border-primary/60 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/40"
                      : "border-border bg-surface-container-high/40 text-muted-foreground hover:bg-surface-container-high",
                  )}
                >
                  <Zap className="size-5 text-primary" />
                  <div>
                    <h4 className="font-bold text-sm text-white">
                      Buscar Marca / Tiempo Objetivo
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Establecer un tiempo meta y calcular los ritmos de
                      parciales correspondientes.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Target Time & Target Pace */}
            {goalType === "tiempo" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4 animate-in fade-in duration-300">
                <div className="flex flex-col gap-2">
                  <Label className="font-semibold text-xs text-muted-foreground">
                    Tiempo Objetivo (HH:MM:SS)
                  </Label>
                  <Input
                    value={targetTime}
                    onChange={(e) => setTargetTime(e.target.value)}
                    placeholder="Ej: 01:45:00 o 45:30"
                    className={fieldInputClass}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Formato: HH:MM:SS o MM:SS
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="font-semibold text-xs text-muted-foreground">
                    Ritmo Promedio Proyectado
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={targetPace ? `${targetPace} /km` : "--:-- /km"}
                      className="bg-surface-container-highest border-border text-primary font-bold focus-visible:ring-0 rounded-xl cursor-default text-sm"
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Calculado automáticamente para{" "}
                    {distanceKm ? `${distanceKm} km` : "la distancia"}.
                  </span>
                </div>
              </div>
            )}

            {/* Shoe Selection */}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Label className="font-semibold text-xs text-muted-foreground">
                Calzado Seleccionado para la Carrera
              </Label>
              <select
                className={fieldSelectClass}
                value={shoeId}
                onChange={(e) => {
                  userPickedShoe.current = true
                  setShoeId(e.target.value)
                }}
              >
                <option value="">Sin calzado asignado</option>
                {(shoesQuery.data?.data ?? []).map((shoe) => (
                  <option key={shoe.id} value={shoe.id}>
                    {shoe.name} {shoe.brand ? `(${shoe.brand})` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Podés asociar tus zapatillas de competición para contabilizar el
                desgaste del evento.
              </p>
            </div>

            {/* Bottom Nav */}
            <div className="flex justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-border text-muted-foreground rounded-xl"
                onClick={() => setStep(2)}
              >
                <ChevronLeft className="size-4 mr-1" /> Atrás
              </Button>
              <Button
                type="button"
                onClick={() => setStep(4)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
              >
                <span>Siguiente: Logística</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Logística */}
      {step === 4 && (
        <Card className="p-6 bg-card border-border shadow-card rounded-2xl">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Navigation className="size-5 text-primary" />
              4. Logística y Preparación (Opcional)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Horario de Largada
                </Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={fieldInputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Estado de Inscripción
                </Label>
                <select
                  className={fieldSelectClass}
                  value={status || ""}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  {STATUS_OPTIONS.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Dorsal / Bib Number
                </Label>
                <Input
                  value={bibNumber}
                  onChange={(e) => setBibNumber(e.target.value)}
                  placeholder="Ej: A-1024 o 3481"
                  className={fieldInputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Corral / Cajón de Salida
                </Label>
                <Input
                  value={corral}
                  onChange={(e) => setCorral(e.target.value)}
                  placeholder="Ej: Cajón Verde (< 3h45) o Bloque B"
                  className={fieldInputClass}
                />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Lugar y Fecha de Retiro de Kit
                </Label>
                <Input
                  value={kitRetrievalInfo}
                  onChange={(e) => setKitRetrievalInfo(e.target.value)}
                  placeholder="Ej: Expo Running La Rural, Pabellón Ocre, Viernes de 10 a 20hs"
                  className={fieldInputClass}
                />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Sitio Web Oficial o Comprobante (URL)
                </Label>
                <Input
                  value={webLink}
                  onChange={(e) => setWebLink(e.target.value)}
                  placeholder="https://..."
                  className={fieldInputClass}
                />
              </div>
            </div>

            {/* Tactical Strategies */}
            <div className="flex flex-col gap-4 border-t border-border pt-4">
              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Estrategia: Ritmos y Splits (Opcional)
                </Label>
                <textarea
                  rows={3}
                  className={fieldTextareaClass}
                  value={splitsStrategy}
                  onChange={(e) => setSplitsStrategy(e.target.value)}
                  placeholder="Ej: km 1-5 suave a 5:00/km, km 6-18 crucero 4:45/km, últimos 3km en negativo..."
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Estrategia: Nutrición e Hidratación (Opcional)
                </Label>
                <textarea
                  rows={3}
                  className={fieldTextareaClass}
                  value={nutritionPlan}
                  onChange={(e) => setNutritionPlan(e.target.value)}
                  placeholder="Ej: Gel isotónico en km 8 y 15. Agua en cada puesto oficial..."
                />
              </div>
            </div>

            {/* Bottom Nav */}
            <div className="flex justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-border text-muted-foreground rounded-xl"
                onClick={() => setStep(3)}
              >
                <ChevronLeft className="size-4 mr-1" /> Atrás
              </Button>
              <Button
                type="button"
                onClick={() => setStep(5)}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
              >
                <span>Siguiente: Resultados y Fotos</span>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: Resultados */}
      {step === 5 && (
        <Card className="p-6 bg-card border-border shadow-card rounded-2xl">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-white">
              <Sparkles className="size-5 text-primary" />
              5. Resultados y Post-Carrera
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Podés registrar tus marcas finales, vincular la actividad de
              Strava y subir las fotos oficiales para tu baúl de recuerdos.
            </p>
          </CardHeader>
          <CardContent className="px-0 flex flex-col gap-6">
            {/* Times */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Tiempo Oficial (Gun Time)
                </Label>
                <Input
                  value={officialTime}
                  onChange={(e) => setOfficialTime(e.target.value)}
                  placeholder="01:45:00"
                  className={fieldInputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Tiempo Neto (Chip Time)
                </Label>
                <Input
                  value={chipTime}
                  onChange={(e) => setChipTime(e.target.value)}
                  placeholder="01:44:15"
                  className={fieldInputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Puesto General
                </Label>
                <Input
                  type="number"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Ej: 142"
                  className={fieldInputClass}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="font-semibold text-xs text-muted-foreground">
                  Categoría
                </Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Ej: M 35-39"
                  className={fieldInputClass}
                />
              </div>
            </div>

            {/* Strava Activity Link */}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Label className="font-semibold text-xs text-muted-foreground">
                Actividad de Strava Vinculada
              </Label>
              <select
                className={fieldSelectClass}
                value={activityId}
                onChange={(e) => {
                  const nextActivityId = e.target.value
                  setActivityId(nextActivityId)
                  if (!userPickedShoe.current) {
                    const activity = (activitiesQuery.data?.data ?? []).find(
                      (a) => a.id === nextActivityId,
                    )
                    if (activity?.cardio?.shoe_id) {
                      setShoeId(activity.cardio.shoe_id)
                    }
                  }
                }}
              >
                <option value="">Ninguna</option>
                {(activitiesQuery.data?.data ?? []).map((activity) => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name} · {activity.timestamp.slice(0, 10)}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Label className="font-semibold text-xs text-muted-foreground">
                Bitácora y Notas Personales
              </Label>
              <textarea
                rows={4}
                className={fieldTextareaClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="¿Cómo te sentiste? Sensaciones físicas y mentales, clima, hidratación, lecciones aprendidas..."
              />
            </div>

            {/* Photos */}
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <Label className="font-semibold text-xs text-muted-foreground flex items-center gap-2">
                <Camera className="size-4 text-primary" /> Fotos del Evento
              </Label>
              <div className="flex flex-wrap gap-3">
                {photos.map((url, index) => (
                  <div
                    key={index}
                    className="relative h-24 w-24 overflow-hidden rounded-xl border border-border shadow-card group"
                  >
                    <img
                      src={url}
                      alt={`Foto ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white hover:bg-destructive transition-colors cursor-pointer"
                      onClick={() =>
                        setPhotos((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
                <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-card/60 text-muted-foreground hover:bg-surface-container-high hover:text-white transition-colors">
                  {uploading ? (
                    <Loader2 className="size-6 animate-spin text-primary" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImagePlus className="size-6" />
                      <span className="text-[10px] font-bold">Subir</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={uploadPhoto}
                  />
                </label>
              </div>
            </div>

            {/* Bottom Nav */}
            <div className="flex justify-between border-t border-border pt-4">
              <Button
                type="button"
                variant="outline"
                className="border-border text-muted-foreground rounded-xl"
                onClick={() => setStep(4)}
              >
                <ChevronLeft className="size-4 mr-1" /> Atrás
              </Button>
              <Button
                type="button"
                disabled={mutation.isPending || !canProceedStep1}
                onClick={() => mutation.mutate()}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-card shadow-primary/20"
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4 stroke-[3]" />
                )}
                <span>{editId ? "Guardar Cambios" : "Guardar Carrera"}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

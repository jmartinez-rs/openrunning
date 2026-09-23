import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  ImagePlus,
  Loader2,
  MapPin,
  Navigation,
  Target,
  Trophy,
  X,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  ActivitiesService,
  type ApiError,
  type RacePublic,
  RacesService,
  ShoesService,
  StorageService,
} from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { handleError } from "@/utils"
import { parseRaceNotes, type RaceMeta, stringifyRaceNotes } from "./race-meta"
import { parseRaceTime, secondsToTimeInput } from "./race-utils"

interface RaceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  race?: RacePublic | null
  defaultActivityId?: string
}

const STEPS = [
  { id: 1, title: "Datos del Evento" },
  { id: 2, title: "Prioridad y Plan" },
  { id: 3, title: "Objetivos" },
  { id: 4, title: "Logística" },
  { id: 5, title: "Resultados" },
] as const

const inputClass =
  "bg-background border-border text-white focus-visible:ring-primary/50 rounded-xl"
const selectClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"

function StepHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-5 text-primary" />
      <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
    </div>
  )
}

export function RaceFormDialog({
  open,
  onOpenChange,
  race,
  defaultActivityId,
}: RaceFormDialogProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const initialMeta = parseRaceNotes(race?.notes)

  // 1. Esencial
  const [eventName, setEventName] = useState(race?.event_name ?? "")
  const [distanceKm, setDistanceKm] = useState(
    race?.distance_km != null ? String(race.distance_km) : "",
  )
  const [date, setDate] = useState(race?.date ? race.date.slice(0, 10) : "")
  const [startTime, setStartTime] = useState(initialMeta.start_time ?? "")
  const [location, setLocation] = useState(race?.location ?? "")
  const [surfaceType, setSurfaceType] = useState<RaceMeta["surface_type"]>(
    initialMeta.surface_type ?? "",
  )
  const [elevationProfile, setElevationProfile] = useState<
    RaceMeta["elevation_profile"]
  >(initialMeta.elevation_profile ?? "")

  // 2. Prioridad y Plan
  const [priority, setPriority] = useState<RaceMeta["priority"]>(
    initialMeta.priority ?? "",
  )
  const [linkToPlan, setLinkToPlan] = useState(false) // Fake for now

  // 3. Objetivos de Rendimiento
  const [goalType, setGoalType] = useState<RaceMeta["goal_type"]>(
    initialMeta.goal_type ?? "",
  )
  const [targetTime, setTargetTime] = useState(initialMeta.target_time ?? "")
  const [targetPace, setTargetPace] = useState(initialMeta.target_pace ?? "")
  const [shoeId, setShoeId] = useState(race?.shoe_id ?? "")

  // 4. Logística
  const [bibNumber, setBibNumber] = useState(race?.bib_number ?? "")
  const [corral, setCorral] = useState(initialMeta.corral ?? "")
  const [kitRetrievalInfo, setKitRetrievalInfo] = useState(
    initialMeta.kit_retrieval_info ?? "",
  )
  const [webLink, setWebLink] = useState(initialMeta.web_link ?? "")
  const [status, setStatus] = useState<RaceMeta["status"]>(
    initialMeta.status ?? "",
  )
  const [splitsStrategy, setSplitsStrategy] = useState(
    initialMeta.splits_strategy ?? "",
  )
  const [nutritionPlan, setNutritionPlan] = useState(
    initialMeta.nutrition_plan ?? "",
  )

  // 5. Post-Carrera (Resultados)
  const [officialTime, setOfficialTime] = useState(
    secondsToTimeInput(race?.official_time_seconds),
  )
  const [chipTime, setChipTime] = useState(
    secondsToTimeInput(race?.chip_time_seconds),
  )
  const [position, setPosition] = useState(
    race?.position != null ? String(race.position) : "",
  )
  const [category, setCategory] = useState(race?.category ?? "")
  const [activityId, setActivityId] = useState(
    race?.activity_id ?? defaultActivityId ?? "",
  )
  const [notes, setNotes] = useState(initialMeta.raw_notes ?? "")
  const [photos, setPhotos] = useState<string[]>(race?.photos_urls ?? [])

  const [uploading, setUploading] = useState(false)
  const userPickedShoe = useRef(false)

  // Wizard step state
  const [step, setStep] = useState(1)
  useEffect(() => {
    if (open) setStep(1)
  }, [open])

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

  const activitiesQuery = useQuery({
    queryKey: ["activities", "strava"],
    queryFn: () =>
      ActivitiesService.readActivities({ sourceType: "strava", limit: 100 }),
    enabled: open,
  })

  const shoesQuery = useQuery({
    queryKey: ["shoes"],
    queryFn: () => ShoesService.readShoes({ limit: 100 }),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        event_name: eventName,
        date: date
          ? new Date(`${date}T12:00:00`).toISOString()
          : new Date().toISOString(),
        distance_km: Number(distanceKm) || 0,
        location: location || null,
        official_time_seconds: parseRaceTime(officialTime),
        chip_time_seconds: parseRaceTime(chipTime),
        position: position ? Number(position) : null,
        category: category || null,
        bib_number: bibNumber || null,
        notes: stringifyRaceNotes({
          priority,
          status,
          corral,
          start_time: startTime,
          target_pace: targetPace,
          target_time: targetTime,
          splits_strategy: splitsStrategy,
          nutrition_plan: nutritionPlan,
          raw_notes: notes,
          surface_type: surfaceType,
          elevation_profile: elevationProfile,
          goal_type: goalType,
          kit_retrieval_info: kitRetrievalInfo,
          web_link: webLink,
        }),
        activity_id: activityId || null,
        shoe_id: shoeId || null,
        photos_urls: photos,
      }
      if (race) {
        return RacesService.updateRace({
          raceId: race.id,
          requestBody: payload,
        })
      }
      return RacesService.createRace({ requestBody: payload })
    },
    onSuccess: () => {
      showSuccessToast(race ? "Carrera actualizada" : "Carrera registrada")
      queryClient.invalidateQueries({ queryKey: ["races"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      queryClient.invalidateQueries({ queryKey: ["shoe-stats"] })
      onOpenChange(false)
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

  const canProceed =
    step === 1 ? Boolean(eventName && distanceKm && date) : true

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl overflow-hidden bg-card border-border text-white sm:rounded-2xl p-0 gap-0 flex flex-col">
        <DialogHeader className="p-6 border-b border-border bg-card/90 backdrop-blur-md z-10 shrink-0">
          <DialogTitle className="text-xl font-black text-white tracking-tight">
            {race ? "Editar Carrera" : "Añadir Carrera"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Estructura los detalles, metas y logística de tu evento.
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-6 pb-4 border-b border-border shrink-0">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={cn(
                "flex flex-col gap-1 p-2.5 rounded-xl text-left border transition-all duration-200 cursor-pointer",
                step === s.id
                  ? "border-primary/60 bg-primary/15 text-primary shadow-sm"
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
            </button>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 p-6">
          {/* STEP 1: Datos del Evento */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <StepHeader icon={Flag} title="1. Datos del Evento" />
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Nombre de la Carrera
                </Label>
                <Input
                  className={inputClass}
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Buscador predictivo o texto libre (Ej: NB 15K)"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 min-w-0">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Distancia Oficial (km)
                  </Label>
                  <div className="flex gap-2">
                    <select
                      className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                    >
                      <option value="">Personalizada</option>
                      <option value="5">5K</option>
                      <option value="10">10K</option>
                      <option value="15">15K</option>
                      <option value="21.1">21K (Media)</option>
                      <option value="42.2">42K (Maratón)</option>
                    </select>
                    <Input
                      className="flex-1 bg-background border-border text-white focus-visible:ring-primary/50 rounded-xl"
                      type="number"
                      step="0.1"
                      value={distanceKm}
                      onChange={(e) => setDistanceKm(e.target.value)}
                      placeholder="Dist."
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Ubicación
                  </Label>
                  <Input
                    className={inputClass}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ciudad, País"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Fecha
                  </Label>
                  <Input
                    className={inputClass}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Tipo de Superficie
                  </Label>
                  <select
                    className={selectClass}
                    value={surfaceType || ""}
                    onChange={(e) => setSurfaceType(e.target.value as any)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="calle">Calle / Asfalto</option>
                    <option value="pista">Pista</option>
                    <option value="trail">Trail / Montaña</option>
                    <option value="mixto">Mixto</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Perfil de Altimetría
                  </Label>
                  <select
                    className={selectClass}
                    value={elevationProfile || ""}
                    onChange={(e) => setElevationProfile(e.target.value as any)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="plano">Plano</option>
                    <option value="ondulado">Ondulado</option>
                    <option value="subidas">Subidas pronunciadas</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Prioridad y Plan */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <StepHeader
                icon={MapPin}
                title="2. Prioridad y Plan de Entrenamiento"
              />
              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Prioridad de la Carrera
                </Label>
                <select
                  className={selectClass}
                  value={priority || ""}
                  onChange={(e) => setPriority(e.target.value as any)}
                >
                  <option value="">No definida</option>
                  <option value="A">
                    🥇 Objetivo A (Principal de temporada)
                  </option>
                  <option value="B">
                    🥈 Objetivo B (Preparatoria / Tune-up)
                  </option>
                  <option value="C">
                    🥉 Objetivo C (Recreativa / Acompañamiento)
                  </option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Vincular a Plan de Entrenamiento
                </Label>
                <select
                  className={selectClass}
                  value={linkToPlan ? "yes" : "no"}
                  onChange={(e) => setLinkToPlan(e.target.value === "yes")}
                >
                  <option value="no">Sin plan asociado (por defecto)</option>
                  <option value="yes">Sí, crear/integrar al plan actual</option>
                </select>
                <span className="text-xs text-on-surface-variant mt-1">
                  La integración con el calendario ajustará los días de descarga
                  (*tapering*).
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Objetivos */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <StepHeader icon={Target} title="3. Objetivos de Rendimiento" />
              <div className="grid sm:grid-cols-2 gap-3 min-w-0">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Tipo de Meta
                  </Label>
                  <select
                    className={selectClass}
                    value={goalType || ""}
                    onChange={(e) => setGoalType(e.target.value as any)}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="completar">
                      Completar la distancia (Sin presión de tiempo)
                    </option>
                    <option value="tiempo">
                      Buscar marca / Tiempo objetivo (Time Goal)
                    </option>
                  </select>
                </div>

                {goalType === "tiempo" && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Tiempo Objetivo
                      </Label>
                      <Input
                        className={inputClass}
                        value={targetTime}
                        onChange={(e) => setTargetTime(e.target.value)}
                        placeholder="01:14:30"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Ritmo Promedio Proyectado
                      </Label>
                      <Input
                        className="bg-background border-border text-muted-foreground focus-visible:ring-primary/50 rounded-xl cursor-not-allowed font-medium"
                        value={targetPace ? `${targetPace} /km` : "--:-- /km"}
                        readOnly
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Calzado a utilizar
                  </Label>
                  <select
                    className={selectClass}
                    value={shoeId}
                    onChange={(e) => {
                      userPickedShoe.current = true
                      setShoeId(e.target.value)
                    }}
                  >
                    <option value="">Sin calzado asignado</option>
                    {(shoesQuery.data?.data ?? []).map((shoe) => (
                      <option key={shoe.id} value={shoe.id}>
                        {shoe.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Logística */}
          {step === 4 && (
            <div className="flex flex-col gap-4">
              <StepHeader
                icon={Navigation}
                title="4. Logística y Evento (Opcional)"
              />
              <div className="grid sm:grid-cols-2 gap-3 min-w-0">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Horario de Largada
                  </Label>
                  <Input
                    className={inputClass}
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Estado de Inscripción
                  </Label>
                  <select
                    className={selectClass}
                    value={status || ""}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="">Desconocido</option>
                    <option value="confirmed">Confirmada</option>
                    <option value="pending_payment">Pago pendiente</option>
                    <option value="pending_kit">Retiro de kit pendiente</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Dorsal / Bib Number
                  </Label>
                  <Input
                    className={inputClass}
                    value={bibNumber}
                    onChange={(e) => setBibNumber(e.target.value)}
                    placeholder="Ej: A-1024"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Corral / Cajón de salida
                  </Label>
                  <Input
                    className={inputClass}
                    value={corral}
                    onChange={(e) => setCorral(e.target.value)}
                    placeholder="Ej: Cajón Verde"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Lugar y Fecha de Retiro de Kit
                  </Label>
                  <Input
                    className={inputClass}
                    value={kitRetrievalInfo}
                    onChange={(e) => setKitRetrievalInfo(e.target.value)}
                    placeholder="Ej: Expo Running, Viernes 14hs"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Web oficial o Comprobante (URL)
                  </Label>
                  <Input
                    className={inputClass}
                    value={webLink}
                    onChange={(e) => setWebLink(e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Estrategia: Splits (Opcional)
                  </Label>
                  <textarea
                    className="rounded-xl border border-border bg-surface-container-lowest px-3 py-2 text-sm text-white min-h-[60px]"
                    value={splitsStrategy}
                    onChange={(e) => setSplitsStrategy(e.target.value)}
                    placeholder="Ej: km 1-5 suave, km 6-12 ritmo crucero..."
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Estrategia: Nutrición (Opcional)
                  </Label>
                  <textarea
                    className="rounded-xl border border-border bg-surface-container-lowest px-3 py-2 text-sm text-white min-h-[60px]"
                    value={nutritionPlan}
                    onChange={(e) => setNutritionPlan(e.target.value)}
                    placeholder="Ej: Geles en km 10, 20 y 30."
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Resultados */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <StepHeader icon={Trophy} title="5. Resultados y Post-Carrera" />
              <div className="grid sm:grid-cols-2 gap-3 min-w-0">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Tiempo Oficial
                  </Label>
                  <Input
                    className={inputClass}
                    value={officialTime}
                    onChange={(e) => setOfficialTime(e.target.value)}
                    placeholder="01:15:00"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Tiempo Neto (Chip)
                  </Label>
                  <Input
                    className={inputClass}
                    value={chipTime}
                    onChange={(e) => setChipTime(e.target.value)}
                    placeholder="01:14:45"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Puesto General
                  </Label>
                  <Input
                    className={inputClass}
                    type="number"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Puesto (ej: 12)"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Categoría
                  </Label>
                  <Input
                    className={inputClass}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ej: M40"
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2 mt-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Actividad de Strava vinculada
                  </Label>
                  <select
                    className={selectClass}
                    value={activityId}
                    onChange={(e) => {
                      const nextActivityId = e.target.value
                      setActivityId(nextActivityId)
                      if (!userPickedShoe.current) {
                        const activity = (
                          activitiesQuery.data?.data ?? []
                        ).find((a) => a.id === nextActivityId)
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

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Bitácora y Notas Personales
                  </Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-xl border border-border bg-surface-container-lowest px-3 py-2 text-sm text-white shadow-sm"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="¿Cómo te sentiste? ¿Clima? Lecciones aprendidas..."
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Camera className="size-3" /> Fotos del Evento
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {photos.map((url, index) => (
                      <div
                        key={index}
                        className="relative h-20 w-20 overflow-hidden rounded-xl border border-border"
                      >
                        <img
                          src={url}
                          alt={`Foto ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                          onClick={() =>
                            setPhotos((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                    <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-card/50 text-on-surface-variant hover:bg-surface-container-high transition-colors">
                      {uploading ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <ImagePlus className="size-5" />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={uploadPhoto}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-6 border-t border-border bg-card sticky bottom-0 z-10 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between rounded-b-2xl shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-foreground hover:text-white"
          >
            Cancelar
          </Button>
          <div className="flex gap-3 sm:justify-end">
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="rounded-xl"
              >
                <ChevronLeft className="size-4" /> Atrás
              </Button>
            )}
            {step < 5 ? (
              <Button
                type="button"
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card shadow-primary/20"
                disabled={!canProceed}
                onClick={() => setStep(step + 1)}
              >
                Siguiente <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-card shadow-primary/20"
                disabled={mutation.isPending || !canProceed}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Guardar y añadir al calendario
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

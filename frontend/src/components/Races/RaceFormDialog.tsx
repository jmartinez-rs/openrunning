import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ImagePlus, Loader2, X } from "lucide-react"
import { useRef, useState } from "react"

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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { parseRaceTime, secondsToTimeInput } from "./race-utils"

interface RaceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  race?: RacePublic | null
}

export function RaceFormDialog({
  open,
  onOpenChange,
  race,
}: RaceFormDialogProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const [eventName, setEventName] = useState(race?.event_name ?? "")
  const [date, setDate] = useState(race?.date ? race.date.slice(0, 10) : "")
  const [distanceKm, setDistanceKm] = useState(
    race?.distance_km != null ? String(race.distance_km) : "",
  )
  const [location, setLocation] = useState(race?.location ?? "")
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
  const [bibNumber, setBibNumber] = useState(race?.bib_number ?? "")
  const [notes, setNotes] = useState(race?.notes ?? "")
  const [activityId, setActivityId] = useState(race?.activity_id ?? "")
  const [shoeId, setShoeId] = useState(race?.shoe_id ?? "")
  const [photos, setPhotos] = useState<string[]>(race?.photos_urls ?? [])
  const [uploading, setUploading] = useState(false)
  const userPickedShoe = useRef(false)

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
        notes: notes || null,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {race ? "Editar carrera" : "Registrar carrera"}
          </DialogTitle>
          <DialogDescription>
            Guardá el evento, tus tiempos y la bitácora.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="race-name">Evento</Label>
              <Input
                id="race-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="Ej: 15k Puerto Madero"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="race-date">Fecha</Label>
              <Input
                id="race-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="race-distance">Distancia (km)</Label>
              <Input
                id="race-distance"
                type="number"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                placeholder="21.1"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="race-location">Lugar</Label>
              <Input
                id="race-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ciudad"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="race-official">Tiempo oficial (mm:ss)</Label>
              <Input
                id="race-official"
                value={officialTime}
                onChange={(e) => setOfficialTime(e.target.value)}
                placeholder="42:30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="race-chip">Tiempo chip (mm:ss)</Label>
              <Input
                id="race-chip"
                value={chipTime}
                onChange={(e) => setChipTime(e.target.value)}
                placeholder="42:18"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="race-position">Puesto</Label>
              <Input
                id="race-position"
                type="number"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="123"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="race-bib">Dorsal</Label>
              <Input
                id="race-bib"
                value={bibNumber}
                onChange={(e) => setBibNumber(e.target.value)}
                placeholder="A-1024"
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="race-category">Categoría</Label>
              <Input
                id="race-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="General / M40 / ..."
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Actividad de Strava vinculada</Label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
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

          <div className="flex flex-col gap-1.5">
            <Label>Calzado</Label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={shoeId}
              onChange={(e) => {
                userPickedShoe.current = true
                setShoeId(e.target.value)
              }}
            >
              <option value="">Sin calzado</option>
              {(shoesQuery.data?.data ?? []).map((shoe) => (
                <option key={shoe.id} value={shoe.id}>
                  {shoe.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Fotos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((url, index) => (
                <div
                  key={index}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border"
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
                      setPhotos((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted">
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="race-notes">Bitácora</Label>
            <textarea
              id="race-notes"
              className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Estrategia, sensaciones, clima..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!eventName.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

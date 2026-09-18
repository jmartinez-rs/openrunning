import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useRef } from "react"

import { decodePolyline } from "./polyline"

export function ActivityMap({ encoded }: { encoded: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const points = decodePolyline(encoded)
    if (points.length < 2) return

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
    }).setView(points[0], 13)

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map)

    const cardioColor = "#f97316" // Orange accent matching Strava/Cardio

    L.polyline(points, {
      color: cardioColor,
      weight: 5,
      opacity: 0.9,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map)

    map.fitBounds(L.latLngBounds(points), { padding: [24, 24] })

    return () => {
      map.remove()
    }
  }, [encoded])

  return <div ref={containerRef} className="h-80 w-full rounded-2xl z-0" />
}

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

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const cardioColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--domain-cardio")
        .trim() || "#ea580c"

    L.polyline(points, { color: cardioColor, weight: 4 }).addTo(map)
    map.fitBounds(L.latLngBounds(points))

    return () => {
      map.remove()
    }
  }, [encoded])

  return <div ref={containerRef} className="h-72 w-full rounded-lg z-0" />
}

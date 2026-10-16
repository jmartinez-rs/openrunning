import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { useEffect, useRef } from "react"
import { decodePolyline } from "./polyline"

interface ActivityMapProps {
  encoded: string
  className?: string
  lineColor?: string
}

export function ActivityMap({
  encoded,
  className = "h-80 w-full",
  lineColor = "#FC5200",
}: ActivityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const points = decodePolyline(encoded)
    if (points.length < 2) return

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: false,
    }).setView(points[0], 13)

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    // Trazado de ruta
    L.polyline(points, {
      color: lineColor,
      weight: 4.5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map)

    // Marcador de inicio (círculo verde menta)
    L.circleMarker(points[0], {
      radius: 5,
      color: "#FFFFFF",
      weight: 2,
      fillColor: "#10B981",
      fillOpacity: 1,
    }).addTo(map)

    // Marcador de llegada (círculo rojo/meta)
    L.circleMarker(points[points.length - 1], {
      radius: 5,
      color: "#FFFFFF",
      weight: 2,
      fillColor: "#EF4444",
      fillOpacity: 1,
    }).addTo(map)

    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [36, 36] })

    // Forzar renderizado de tiles al montar
    const timer = setTimeout(() => {
      map.invalidateSize()
      map.fitBounds(bounds, { padding: [36, 36] })
    }, 150)

    return () => {
      clearTimeout(timer)
      map.remove()
    }
  }, [encoded, lineColor])

  return (
    <div
      ref={containerRef}
      className={`w-full z-0 overflow-hidden ${className}`}
    />
  )
}

"use client"

import { useEffect, useRef } from "react"
import type { Geometry } from "geojson"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { CityOption } from "@/lib/cities"
import { darkenColor, heatIndexColor } from "@/lib/heat-index-colors"

export type CityHeatLayer = CityOption & {
  heatIndex: number | null
}

type CityMapProps = {
  city: CityOption
  cityReadings: CityHeatLayer[]
  onSelectCity?: (city: CityHeatLayer) => void
}

type BoundaryCache = Record<string, Geometry>

type LayerCache = Record<string, L.GeoJSON>

export function CityMap({ city, cityReadings, onSelectCity }: CityMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const boundaryCacheRef = useRef<BoundaryCache>({})
  const layerCacheRef = useRef<LayerCache>({})

  useEffect(() => {
    if (!mapContainerRef.current) {
      return
    }

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [city.lat, city.lon],
        zoom: 12,
        zoomControl: false,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapRef.current)
    }

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) {
      return
    }
    mapRef.current.setView([city.lat, city.lon], 12, { animate: true })
  }, [city.lat, city.lon])

  useEffect(() => {
    if (!mapRef.current) {
      return
    }
    const map = mapRef.current
    const abortController = new AbortController()
    let cancelled = false

    const ensureBoundary = async (cityName: string): Promise<Geometry | null> => {
      const cached = boundaryCacheRef.current[cityName]
      if (cached) {
        return cached
      }
      try {
        const params = new URLSearchParams({
          format: "geojson",
          polygon_geojson: "1",
          bounded: "1",
          limit: "1",
          q: `${cityName}, Cavite, Philippines`,
          email: "inet-ready@example.com",
        })
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          headers: { Accept: "application/json" },
          signal: abortController.signal,
        })
        if (!response.ok) {
          throw new Error(`Failed to load boundary for ${cityName}`)
        }
        const data = (await response.json()) as { features?: { geometry: Geometry }[] }
        const geometry = data.features?.[0]?.geometry
        if (geometry) {
          boundaryCacheRef.current[cityName] = geometry
        }
        return geometry ?? null
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          console.error(error)
        }
        return null
      }
    }

    const removeStaleLayers = () => {
      const activeNames = new Set(cityReadings.map((entry) => entry.name))
      Object.entries(layerCacheRef.current).forEach(([name, layer]) => {
        if (!activeNames.has(name)) {
          layer.remove()
          delete layerCacheRef.current[name]
        }
      })
    }

    const renderLayers = async () => {
      removeStaleLayers()
      for (const entry of cityReadings) {
        const geometry = await ensureBoundary(entry.name)
        if (!geometry || cancelled) {
          continue
        }

        layerCacheRef.current[entry.name]?.remove()

        const fillColor = heatIndexColor(entry.heatIndex)
        const borderColor = darkenColor(fillColor, entry.name === city.name ? 0.45 : 0.3)
        const layer = L.geoJSON(geometry, {
          style: {
            color: borderColor,
            weight: entry.name === city.name ? 2.5 : 1,
            fillColor,
            fillOpacity: entry.name === city.name ? 0.65 : 0.35,
          },
        })

        layer.on("click", () => {
          if (!onSelectCity) {
            return
          }
          onSelectCity(entry)
        })

        layer.addTo(map)
        layerCacheRef.current[entry.name] = layer

        if (entry.name === city.name) {
          const bounds = layer.getBounds()
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 })
          }
        }
      }
    }

    renderLayers()

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [city, cityReadings, onSelectCity])

  return <div ref={mapContainerRef} className="h-full w-full" />
}

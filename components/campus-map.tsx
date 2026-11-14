'use client'

import { useEffect, useRef } from 'react'
import type L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type MapLayer = 'no-go' | 'terrain' | 'parking'
type MapAction = { type: 'zoom-in' | 'zoom-out' | 'locate'; id: number }

export function CampusMap({ activeLayers, action, onLocationError }: { activeLayers: MapLayer[]; action?: MapAction; onLocationError?: (message: string | null) => void }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<L.Map | null>(null)
  const leafletModuleRef = useRef<typeof import('leaflet') | null>(null)
  const overlaysRef = useRef<Record<string, L.LayerGroup>>({})
  const locationMarkerRef = useRef<L.CircleMarker | null>(null)
  const locationWatchRef = useRef<number | null>(null)
  const onLocationErrorRef = useRef(onLocationError)
  onLocationErrorRef.current = onLocationError

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return
    let map: L.Map
    const initialize = async () => {
    const L = (await import('leaflet')).default
    map = L.map(mapRef.current!, { zoomControl: false, attributionControl: true }).setView([47.6553, -122.3035], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const noGo = L.layerGroup([
      L.circle([47.658, -122.307], { radius: 140, color: '#b42318', fillColor: '#fecdca', fillOpacity: 0.55, weight: 2 }).bindTooltip('Lime no-go zone', { sticky: true }),
      L.polygon([[47.6539, -122.3025], [47.6552, -122.3012], [47.6548, -122.2994], [47.6536, -122.3003]], { color: '#b42318', fillColor: '#fecdca', fillOpacity: 0.65, weight: 2 }).bindTooltip('Scooters not permitted here', { sticky: true }),
    ])
    const terrain = L.layerGroup([
      L.polyline([[47.6575, -122.305], [47.6567, -122.3042], [47.6558, -122.3036], [47.6547, -122.303]], { color: '#b54708', weight: 7, opacity: 0.85 }).bindTooltip('Steep slope · 8%', { sticky: true }),
      L.marker([47.6538, -122.304], { icon: L.divIcon({ className: 'stairs-marker', html: '<span aria-label="Stairs">≋</span>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).bindTooltip('Stairs · 12 steps', { sticky: true }),
      L.marker([47.6562, -122.3008], { icon: L.divIcon({ className: 'stairs-marker', html: '<span aria-label="Stairs">≋</span>', iconSize: [28, 28], iconAnchor: [14, 14] }) }).bindTooltip('Stairs · alternate route available', { sticky: true }),
    ])
    const parking = L.layerGroup([
      L.circleMarker([47.6542, -122.3065], { radius: 10, color: '#075985', fillColor: '#38bdf8', fillOpacity: 0.9, weight: 3 }).bindTooltip('Accessible parking · 4 spaces', { sticky: true }),
      L.circleMarker([47.6572, -122.3005], { radius: 10, color: '#075985', fillColor: '#38bdf8', fillOpacity: 0.9, weight: 3 }).bindTooltip('Micromobility parking · 8 docks', { sticky: true }),
      L.circleMarker([47.6526, -122.302], { radius: 10, color: '#075985', fillColor: '#38bdf8', fillOpacity: 0.9, weight: 3 }).bindTooltip('Accessible parking · 2 spaces', { sticky: true }),
    ])
    overlaysRef.current = { 'no-go': noGo, terrain, parking }
    leafletModuleRef.current = L
    leafletRef.current = map
    }
    initialize()
    return () => {
      if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current)
      locationWatchRef.current = null
      if (map) map.remove()
      leafletRef.current = null
      leafletModuleRef.current = null
      locationMarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = leafletRef.current
    if (!map) return
    map.setView([47.6553, -122.3035], map.getZoom())
    const overlays = overlaysRef.current
    Object.entries(overlays).forEach(([key, layer]) => {
      if (activeLayers.includes(key as MapLayer)) layer.addTo(map)
      else map.removeLayer(layer)
    })
  }, [activeLayers])

  useEffect(() => {
    const map = leafletRef.current
    if (!map || !action) return
    if (action.type === 'zoom-in') map.zoomIn()
    if (action.type === 'zoom-out') map.zoomOut()
    if (action.type === 'locate') {
      if (!navigator.geolocation) {
        onLocationErrorRef.current?.('Location is not available in this browser.')
        return
      }
      onLocationErrorRef.current?.(null)
      if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current)
      let isFirstPosition = true
      locationWatchRef.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          onLocationErrorRef.current?.(null)
          const position: L.LatLngExpression = [coords.latitude, coords.longitude]
          if (locationMarkerRef.current) {
            locationMarkerRef.current.setLatLng(position)
          } else {
            locationMarkerRef.current = leafletModuleRef.current?.circleMarker(position, {
              radius: 9,
              color: '#ffffff',
              weight: 3,
              fillColor: '#1178b5',
              fillOpacity: 1,
            }) ?? null
            locationMarkerRef.current?.bindTooltip('Your current location').addTo(map)
          }
          if (isFirstPosition) {
            map.setView(position, Math.max(map.getZoom(), 17))
            isFirstPosition = false
          }
        },
        (error) => {
          const message = error.code === error.PERMISSION_DENIED
            ? 'Allow location access in your browser to show your position.'
            : error.code === error.TIMEOUT
              ? 'Could not get your location yet. Please try again.'
              : 'Your location is unavailable right now.'
          onLocationErrorRef.current?.(message)
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
      )
    }
  }, [action, onLocationError])

  return <div ref={mapRef} className="campus-map" aria-label="Interactive map of the University of Washington Seattle campus" role="application" />
}

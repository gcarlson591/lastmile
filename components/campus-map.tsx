'use client'

import { useEffect, useRef } from 'react'
import type L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getMapSymbol, symbolBadgeHtml, type MapLayer, type MapSymbol } from '@/lib/map-symbols'
import type { CalculatedRoute } from '@/lib/routing'

type MapAction = { type: 'zoom-in' | 'zoom-out' | 'locate'; id: number }

export function CampusMap({ activeLayers, action, onLocationError, route, destination }: { activeLayers: MapLayer[]; action?: MapAction; onLocationError?: (message: string | null) => void; route?: { mode?: 'walking' | 'scooter'; data?: CalculatedRoute; start?: { name: string; coordinates: [number, number] }; destination?: { name: string; coordinates: [number, number] } } | null; destination?: { name: string; coordinates: [number, number] } | null }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletRef = useRef<L.Map | null>(null)
  const leafletModuleRef = useRef<typeof import('leaflet') | null>(null)
  const overlaysRef = useRef<Record<string, L.LayerGroup>>({})
  const locationMarkerRef = useRef<L.CircleMarker | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const locationWatchRef = useRef<number | null>(null)
  const onLocationErrorRef = useRef(onLocationError)
  onLocationErrorRef.current = onLocationError

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return
    let map: L.Map | null = null
    let cancelled = false
    const initialize = async () => {
    const L = (await import('leaflet')).default
    if (cancelled || !mapRef.current) return
    map = L.map(mapRef.current, { zoomControl: false, attributionControl: true }).setView([47.6553, -122.3035], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const symbolMarker = (position: L.LatLngExpression, symbol: MapSymbol, tooltip: string) =>
      L.marker(position, { icon: L.divIcon({ className: 'map-symbol-icon', html: symbolBadgeHtml(symbol), iconSize: [26, 26], iconAnchor: [13, 13] }), keyboard: false, alt: symbol.label }).bindTooltip(tooltip, { sticky: true })
    const dataLayers: Record<string, L.LayerGroup> = {
      'no-go': L.layerGroup(),
      'lime-parking': L.layerGroup(),
      terrain: L.layerGroup(),
      parking: L.layerGroup(),
    }
    fetch('/data/uw-seattle-navigation.geojson')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Navigation data unavailable')))
      .then((data) => {
        if (cancelled) return
        const groups: Record<string, L.LayerGroup> = { ...dataLayers }
        const features = Array.isArray(data.features) ? data.features : []
        features.forEach((feature: { properties?: { kind?: string; name?: string }; geometry?: unknown }) => {
          const kind = feature.properties?.kind
          if (kind === 'campus-boundary' && feature.geometry) {
            L.geoJSON(feature as never, { style: { color: '#1178b5', fillColor: '#dff3fb', fillOpacity: 0.08, weight: 3, dashArray: '6 5' } }).bindTooltip('City of Seattle MIO-UW supported boundary').addTo(map!)
            return
          }
          const layerKey = kind === 'scooter-no-go' ? 'no-go' : kind === 'lime-parking' ? 'lime-parking' : kind === 'stairs' || kind === 'steep-slope' ? 'terrain' : kind === 'vehicle-parking' ? 'parking' : null
          if (!layerKey || !feature.geometry) return
          const symbol = getMapSymbol(kind === 'scooter-no-go' ? 'no-go' : kind === 'lime-parking' ? 'lime-parking' : kind === 'stairs' ? 'stairs' : kind === 'steep-slope' ? 'slope' : 'parking')
          const name = feature.properties?.name ?? symbol.label
          const style = { color: symbol.color, fillColor: symbol.fill, fillOpacity: 0.35, weight: 2 }
          const geoLayer = L.geoJSON(feature as never, { style, pointToLayer: (_item, point) => L.marker(point, { icon: L.divIcon({ className: 'map-symbol-icon', html: symbolBadgeHtml(symbol), iconSize: [26, 26], iconAnchor: [13, 13] }) }) }).bindTooltip(name, { sticky: true })
          groups[layerKey].addLayer(geoLayer)
        })
        overlaysRef.current = groups
        Object.entries(groups).forEach(([key, layer]) => { if (activeLayers.includes(key as MapLayer)) layer.addTo(map!) })
      })
      .catch(() => { overlaysRef.current = dataLayers })
    overlaysRef.current = dataLayers
    leafletModuleRef.current = L
    leafletRef.current = map
    }
    initialize()
    return () => {
      cancelled = true
      if (locationWatchRef.current !== null) navigator.geolocation.clearWatch(locationWatchRef.current)
      locationWatchRef.current = null
      map?.remove()
      leafletRef.current = null
      leafletModuleRef.current = null
      locationMarkerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = leafletRef.current
    const L = leafletModuleRef.current
    if (!map || !L) return
    if (destination) {
      map.flyTo(destination.coordinates, Math.max(map.getZoom(), 17), { duration: 0.8 })
      L.marker(destination.coordinates).addTo(map).bindTooltip(destination.name, { permanent: true, direction: 'top' }).openTooltip()
    }
  }, [destination])

  useEffect(() => {
    const map = leafletRef.current
    const L = leafletModuleRef.current
    if (!map || !L) return
    routeLayerRef.current?.removeFrom(map)
    routeLayerRef.current = null
    if (route?.data && route.start && route.destination) {
      const limeRoute = route.mode === 'scooter'
      const color = limeRoute ? '#2e7d43' : '#315f8a'
      routeLayerRef.current = L.layerGroup([
        L.polyline(route.data.geometry, { color, weight: 6, opacity: 0.95, ...(limeRoute ? {} : { dashArray: '9 7' }) }).bindTooltip(limeRoute ? 'Bicycle route · Lime scooter approximation' : 'Walking route', { sticky: true }),
        L.circleMarker(route.start.coordinates, { radius: 7, color: '#fff', weight: 3, fillColor: '#18834d', fillOpacity: 1 }).bindTooltip(`Start: ${route.start.name}`),
        L.circleMarker(route.destination.coordinates, { radius: 7, color: '#fff', weight: 3, fillColor: '#bd3b37', fillOpacity: 1 }).bindTooltip(`Destination: ${route.destination.name}`),
      ]).addTo(map)
      map.fitBounds(L.latLngBounds(route.data.geometry).pad(0.18), { maxZoom: 18 })
    }
    const overlays = overlaysRef.current
    Object.entries(overlays).forEach(([key, layer]) => {
      if (activeLayers.includes(key as MapLayer)) layer.addTo(map)
      else map.removeLayer(layer)
    })
  }, [activeLayers, route])

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

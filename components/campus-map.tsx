'use client'

import { useEffect, useRef } from 'react'
import type L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getMapSymbol, symbolBadgeHtml, type MapLayer, type MapSymbol } from '@/lib/map-symbols'

type MapAction = { type: 'zoom-in' | 'zoom-out' | 'locate'; id: number }

export function CampusMap({ activeLayers, action, onLocationError, route, destination }: { activeLayers: MapLayer[]; action?: MapAction; onLocationError?: (message: string | null) => void; route?: { mode?: 'walking' | 'bicycling' | 'lime'; layers: MapLayer[]; accessibleOnly: boolean; start?: { name: string; coordinates: [number, number] }; destination?: { name: string; coordinates: [number, number] }; geometry?: [number, number][] } | null; destination?: { name: string; coordinates: [number, number] } | null }) {
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

    const noGoSymbol = getMapSymbol('no-go')
    const limeSymbol = getMapSymbol('lime-parking')
    const stairsSymbol = getMapSymbol('stairs')
    const slopeSymbol = getMapSymbol('slope')
    const parkingSymbol = getMapSymbol('parking')
    const symbolMarker = (position: L.LatLngExpression, symbol: MapSymbol, tooltip: string) =>
      L.marker(position, { icon: L.divIcon({ className: 'map-symbol-icon', html: symbolBadgeHtml(symbol), iconSize: [26, 26], iconAnchor: [13, 13] }), keyboard: false, alt: symbol.label }).bindTooltip(tooltip, { sticky: true })
    const areaStyle = (symbol: MapSymbol, fillOpacity: number) => ({ color: symbol.color, fillColor: symbol.fill, fillOpacity, weight: 2 })

    const noGoPolygon: L.LatLngExpression[] = [[47.6539, -122.3025], [47.6552, -122.3012], [47.6548, -122.2994], [47.6536, -122.3003]]
    const noGo = L.layerGroup([
      L.circle([47.658, -122.307], { radius: 140, ...areaStyle(noGoSymbol, 0.55) }).bindTooltip('Lime no-go zone', { sticky: true }),
      symbolMarker([47.658, -122.307], noGoSymbol, 'Lime no-go zone'),
      L.polygon(noGoPolygon, areaStyle(noGoSymbol, 0.65)).bindTooltip('Scooters not permitted here', { sticky: true }),
      symbolMarker(L.polygon(noGoPolygon).getBounds().getCenter(), noGoSymbol, 'Scooters not permitted here'),
    ])
    const slopePath: L.LatLngExpression[] = [[47.6575, -122.305], [47.6567, -122.3042], [47.6558, -122.3036], [47.6547, -122.303]]
    const terrain = L.layerGroup([
      L.polyline(slopePath, { color: slopeSymbol.color, weight: 7, opacity: 0.85 }).bindTooltip('Steep slope · 8%', { sticky: true }),
      symbolMarker([47.6562, -122.3039], slopeSymbol, 'Steep slope · 8%'),
      symbolMarker([47.6538, -122.304], stairsSymbol, 'Stairs · 12 steps'),
      symbolMarker([47.6562, -122.3008], stairsSymbol, 'Stairs · alternate route available'),
    ])
    const parking = L.layerGroup([
      symbolMarker([47.6542, -122.3065], parkingSymbol, 'Car parking · 4 accessible spaces'),
      symbolMarker([47.6572, -122.3005], parkingSymbol, 'Car parking · 8 spaces'),
      symbolMarker([47.6526, -122.302], parkingSymbol, 'Car parking · 2 accessible spaces'),
    ])
    const limeAreas: L.LatLngBoundsLiteral[] = [
      [[47.6563, -122.3062], [47.6568, -122.3052]],
      [[47.6545, -122.3048], [47.6549, -122.304]],
      [[47.6529, -122.3035], [47.6533, -122.3026]],
    ]
    const limeParking = L.layerGroup(limeAreas.flatMap((bounds) => [
      L.rectangle(bounds, areaStyle(limeSymbol, 0.7)).bindTooltip('Lime parking zone', { sticky: true }),
      symbolMarker(L.latLngBounds(bounds).getCenter(), limeSymbol, 'Lime parking zone'),
    ]))
    overlaysRef.current = { 'no-go': noGo, 'lime-parking': limeParking, terrain, parking }
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
    if (route?.geometry?.length && route.start && route.destination) {
      const start = route.start.coordinates
      const destination = route.destination.coordinates
      routeLayerRef.current = L.layerGroup([
        L.polyline(route.geometry, { color: route.mode === 'lime' ? '#2e7d43' : route.mode === 'bicycling' ? '#b87518' : '#315f8a', weight: 6, opacity: 0.95 }).bindTooltip(`${route.mode === 'lime' ? 'Lime scooter' : route.mode === 'bicycling' ? 'Bicycling' : 'Walking'} route from Valhalla`, { sticky: true }),
        L.circleMarker(start, { radius: 7, color: '#fff', weight: 3, fillColor: '#2e7d43', fillOpacity: 1 }).bindTooltip(`Start: ${route.start.name}`),
        L.circleMarker(destination, { radius: 7, color: '#fff', weight: 3, fillColor: '#315f8a', fillOpacity: 1 }).bindTooltip(`Destination: ${route.destination.name}`),
      ]).addTo(map)
      map.fitBounds(L.latLngBounds(route.geometry).pad(0.22), { maxZoom: 17 })
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

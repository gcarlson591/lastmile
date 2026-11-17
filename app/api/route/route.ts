import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { isInsideBoundary, routeStaysInsideBoundary, type CampusBoundary } from '@/lib/routing'

export const runtime = 'nodejs'

function decodePolyline6(encoded: string): [number, number][] {
  const coordinates: [number, number][] = []
  let index = 0
  let latitude = 0
  let longitude = 0

  while (index < encoded.length) {
    const deltas: number[] = []
    for (let coordinate = 0; coordinate < 2; coordinate += 1) {
      let result = 0
      let shift = 0
      let byte = 0
      do {
        if (index >= encoded.length) throw new Error('Invalid route geometry')
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      deltas.push(result & 1 ? ~(result >> 1) : result >> 1)
    }
    latitude += deltas[0]
    longitude += deltas[1]
    coordinates.push([latitude / 1e6, longitude / 1e6])
  }
  return coordinates
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { start?: [number, number]; destination?: [number, number]; mode?: string }
    const validPoint = (point: unknown): point is [number, number] => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && point[0] >= -90 && point[0] <= 90 && point[1] >= -180 && point[1] <= 180
    if (!validPoint(body.start) || !validPoint(body.destination) || !['walking', 'scooter'].includes(body.mode ?? '')) {
      return NextResponse.json({ error: 'Choose valid UW campus locations and a travel mode.' }, { status: 400 })
    }

    let boundary: CampusBoundary | undefined
    try {
      const navigationData = JSON.parse(await readFile(path.join(process.cwd(), 'public/data/uw-seattle-navigation.geojson'), 'utf8')) as { features?: Array<{ properties?: { kind?: string }; geometry?: CampusBoundary }> }
      boundary = navigationData.features?.find((feature) => feature.properties?.kind === 'campus-boundary')?.geometry
    } catch {
      return NextResponse.json({ error: 'Verified UW Seattle campus boundary data could not be loaded.' }, { status: 503 })
    }
    if (!boundary || !['Polygon', 'MultiPolygon'].includes(boundary.type)) {
      return NextResponse.json({ error: 'Routing is disabled until a verified UW Seattle campus boundary is configured.' }, { status: 503 })
    }
    if (!isInsideBoundary(body.start, boundary) || !isInsideBoundary(body.destination, boundary)) {
      return NextResponse.json({ error: 'The start or destination is outside the supported UW Seattle campus boundary.' }, { status: 403 })
    }

    const costing = body.mode === 'walking' ? 'pedestrian' : 'bicycle'
    const requestBody = {
      locations: [body.start, body.destination].map(([lat, lon]) => ({ lat, lon })),
      costing,
      ...(costing === 'bicycle' ? { costing_options: { bicycle: { bicycle_type: 'hybrid' } } } : {}),
      units: 'kilometers',
      directions_options: { units: 'kilometers' },
      shape_format: 'polyline6',
    }
    const response = await fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    })
    const data = await response.json() as {
      error?: string
      trip?: {
        summary?: { length?: number; time?: number }
        legs?: Array<{ shape?: string; maneuvers?: Array<{ instruction?: string; length?: number; time?: number }> }>
      }
    }
    if (!response.ok || !data.trip?.legs?.length) {
      return NextResponse.json({ error: data.error || 'Valhalla could not find a mapped route for these locations.' }, { status: 502 })
    }
    const geometry = data.trip.legs.flatMap((leg) => leg.shape ? decodePolyline6(leg.shape) : [])
    if (geometry.length < 2) return NextResponse.json({ error: 'The routing service returned no usable route geometry.' }, { status: 502 })
    if (!routeStaysInsideBoundary(geometry, boundary)) {
      return NextResponse.json({ error: 'The mapped route leaves the verified UW Seattle campus boundary. No route was returned.' }, { status: 422 })
    }

    return NextResponse.json({
      geometry,
      distance: data.trip.summary?.length ?? 0,
      time: data.trip.summary?.time ?? 0,
      directions: data.trip.legs.flatMap((leg) => (leg.maneuvers ?? []).map((maneuver) => ({
        instruction: maneuver.instruction ?? 'Continue along the mapped route',
        distance: maneuver.length ?? 0,
        time: maneuver.time ?? 0,
      }))),
    })
  } catch {
    return NextResponse.json({ error: 'Valhalla is unavailable or returned an invalid response. Please try again.' }, { status: 502 })
  }
}

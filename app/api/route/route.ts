import { NextResponse } from 'next/server'

const routeModes = ['walking', 'bicycling', 'lime'] as const
type RouteMode = (typeof routeModes)[number]
type Coordinate = { lat: number; lon: number }

function isCoordinate(value: unknown): value is Coordinate {
  if (!value || typeof value !== 'object') return false
  const { lat, lon } = value as Record<string, unknown>
  return typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90
    && typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180
}

function decodePolyline6(encoded: string) {
  const coordinates: [number, number][] = []
  let index = 0
  let latitude = 0
  let longitude = 0

  while (index < encoded.length) {
    const values: number[] = []
    for (let axis = 0; axis < 2; axis += 1) {
      let result = 0
      let shift = 0
      let byte: number
      do {
        if (index >= encoded.length || shift > 30) throw new Error('Invalid Valhalla route geometry')
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      values.push((result & 1) ? ~(result >> 1) : result >> 1)
    }
    latitude += values[0]
    longitude += values[1]
    coordinates.push([latitude / 1e6, longitude / 1e6])
  }

  return coordinates
}

export async function POST(request: Request) {
  let payload: { mode?: RouteMode; start?: Coordinate; destination?: Coordinate }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid route request.' }, { status: 400 })
  }

  const { mode, start, destination } = payload
  if (!mode || !routeModes.includes(mode) || !isCoordinate(start) || !isCoordinate(destination)) {
    return NextResponse.json({ error: 'Choose a supported travel mode and valid start and destination coordinates.' }, { status: 400 })
  }

  const valhallaUrl = process.env.VALHALLA_URL?.trim()
  if (!valhallaUrl) {
    return NextResponse.json({ error: 'Valhalla is not configured. Set VALHALLA_URL to the base URL of your self-hosted Valhalla server.' }, { status: 503 })
  }

  const costing = mode === 'walking' ? 'pedestrian' : mode === 'bicycling' ? 'bicycle' : 'motor_scooter'
  const costingOptions = mode === 'lime' ? { motor_scooter: { top_speed: 40.23 } } : undefined

  try {
    const response = await fetch(`${valhallaUrl.replace(/\/$/, '')}/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locations: [start, destination],
        costing,
        ...(costingOptions ? { costing_options: costingOptions } : {}),
        units: 'kilometers',
        shape_format: 'polyline6',
      }),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    })

    const result = await response.json() as {
      error?: string
      trip?: { legs?: { shape?: string }[]; summary?: { length?: number; time?: number } }
    }
    const encoded = result.trip?.legs?.[0]?.shape
    if (!response.ok || result.error || !encoded) {
      return NextResponse.json({ error: 'Valhalla could not find a route for those locations and travel mode.' }, { status: 422 })
    }

    return NextResponse.json({
      geometry: decodePolyline6(encoded),
      distanceKm: result.trip?.summary?.length,
      durationMinutes: typeof result.trip?.summary?.time === 'number' ? Math.round(result.trip.summary.time / 60) : undefined,
    })
  } catch {
    return NextResponse.json({ error: 'Could not reach the configured Valhalla server. Check VALHALLA_URL and that the server is available.' }, { status: 502 })
  }
}

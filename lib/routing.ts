export type Coordinate = [number, number]

type PolygonGeometry = { type: 'Polygon'; coordinates: number[][][] }
type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: number[][][][] }
export type CampusBoundary = PolygonGeometry | MultiPolygonGeometry
export type RouteManeuver = { instruction: string; distance: number; time: number }
export type CalculatedRoute = {
  geometry: Coordinate[]
  distance: number
  time: number
  directions: RouteManeuver[]
}

function pointOnSegment(point: Coordinate, start: Coordinate, end: Coordinate) {
  const cross = (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1])
  if (Math.abs(cross) > 1e-9) return false
  const lengthSquared = (end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2
  if (lengthSquared < 1e-18) return Math.hypot(point[0] - start[0], point[1] - start[1]) < 1e-9
  const dot = (point[0] - start[0]) * (end[0] - start[0]) + (point[1] - start[1]) * (end[1] - start[1])
  if (dot < 0) return false
  return dot <= lengthSquared
}

function pointInRing(point: Coordinate, ring: number[][]) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const start: Coordinate = [ring[previous][1], ring[previous][0]]
    const end: Coordinate = [ring[index][1], ring[index][0]]
    if (pointOnSegment(point, start, end)) return true
    const crosses = (start[1] > point[1]) !== (end[1] > point[1]) && point[0] < ((end[0] - start[0]) * (point[1] - start[1])) / (end[1] - start[1]) + start[0]
    if (crosses) inside = !inside
  }
  return inside
}

function pointInPolygon(point: Coordinate, rings: number[][][]) {
  return pointInRing(point, rings[0]) && !rings.slice(1).some((hole) => pointInRing(point, hole))
}

export function isInsideBoundary(point: Coordinate, boundary: CampusBoundary) {
  if (boundary.type === 'Polygon') return pointInPolygon(point, boundary.coordinates)
  return boundary.coordinates.some((polygon) => pointInPolygon(point, polygon))
}

export function routeStaysInsideBoundary(geometry: Coordinate[], boundary: CampusBoundary) {
  if (geometry.length < 2) return false
  for (let index = 1; index < geometry.length; index += 1) {
    const start = geometry[index - 1]
    const end = geometry[index]
    const latitudeMeters = (end[0] - start[0]) * 111_320
    const longitudeMeters = (end[1] - start[1]) * 111_320 * Math.cos((start[0] * Math.PI) / 180)
    const steps = Math.max(1, Math.ceil(Math.hypot(latitudeMeters, longitudeMeters) / 10))
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps
      const sample: Coordinate = [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio]
      if (!isInsideBoundary(sample, boundary)) return false
    }
  }
  return true
}

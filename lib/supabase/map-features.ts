import { createSupabaseClient } from './client'

type SupabaseConfig = { url?: string; publishableKey?: string }

export type GeoJSONPoint = {
  type: 'Point'
  coordinates: [number, number]
}

export type GeoJSONLineString = {
  type: 'LineString'
  coordinates: [number, number][]
}

export type GeoJSONPolygon = {
  type: 'Polygon'
  coordinates: [number, number][][]
}

export type MapFeatureGeometry =
  | GeoJSONPoint
  | GeoJSONLineString
  | GeoJSONPolygon

export type MapFeature = {
  id: string
  name: string
  description: string | null
  feature_type: string
  source: string
  metadata: Record<string, unknown> | null
  geometry: MapFeatureGeometry
  created_at?: string
  updated_at?: string
}

export async function getMapFeatures(config: SupabaseConfig): Promise<MapFeature[]> {
  if (!config.url || !config.publishableKey) {
    throw new Error('Supabase configuration is unavailable.')
  }

  const supabase = createSupabaseClient(config.url, config.publishableKey)
  const { data, error } = await supabase
    .from('map_features_geojson')
    .select('*')

  if (error) {
    console.error('Error fetching map features:', error)
    throw error
  }

  return (data ?? []) as MapFeature[]
}

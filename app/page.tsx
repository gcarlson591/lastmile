'use client'

import { useEffect, useState } from 'react'
import { Accessibility, Crosshair, Filter, Heart, Menu, Navigation, Search, Map as MapIcon, Home as HomeIcon, X } from 'lucide-react'
import { CampusMap } from '@/components/campus-map'
import { MapLegend } from '@/components/map-legend'
import { isInsideBoundary, routeStaysInsideBoundary, type CalculatedRoute, type CampusBoundary } from '@/lib/routing'

type Layer = 'no-go' | 'lime-parking' | 'terrain' | 'parking'
type MapAction = { type: 'zoom-in' | 'zoom-out' | 'locate'; id: number }
type Building = { name: string; coordinates: [number, number] }
type TravelMode = 'walking' | 'scooter'
type Route = { id: string; name: string; layers: Layer[]; accessibleOnly: boolean; saved: boolean; openedAt: number; start?: Building; destination?: Building; mode?: TravelMode; data?: CalculatedRoute }
const ROUTES_STORAGE_KEY = 'lastmile-routes-v1'

const buildings: Building[] = [
  { name: 'Suzzallo Library', coordinates: [47.6558, -122.3081] },
  { name: 'Husky Union Building (HUB)', coordinates: [47.655389, -122.305085] },
  { name: 'Mary Gates Hall', coordinates: [47.6566, -122.3087] },
  { name: 'Kane Hall', coordinates: [47.6562, -122.307] },
  { name: 'Odegaard Library', coordinates: [47.6565, -122.3103] },
  { name: 'Paul G. Allen Center', coordinates: [47.6536, -122.305] },
  { name: 'The Quad', coordinates: [47.6571, -122.3077] },
  { name: 'IMA', coordinates: [47.653, -122.301] },
  { name: 'Red Square', coordinates: [47.65583, -122.30944] },
  { name: 'Husky Stadium', coordinates: [47.6503, -122.3016] },
  { name: 'University of Washington Medical Center', coordinates: [47.64892, -122.30659] },
]

const filters: { id: Layer; label: string; description: string; tone: string }[] = [
  { id: 'no-go', label: 'Lime no-go zones', description: "Show zones where Lime bikes and scooters won't work and cannot be parked in", tone: 'coral' },
  { id: 'lime-parking', label: 'Lime parking areas', description: 'Show zones where Lime bikes and scooters can be parked', tone: 'green' },
  { id: 'terrain', label: 'Stairs & slopes', description: 'Show stairs and slopes', tone: 'amber' },
  { id: 'parking', label: 'Parking areas', description: 'Show car parking areas', tone: 'blue' },
]

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  return minutes < 1 ? 'under 1 min' : `${minutes} min`
}

function routeName(layers: Layer[], accessibleOnly: boolean) {
  if (accessibleOnly) return 'Accessible campus route'
  const selected = filters.filter((filter) => layers.includes(filter.id)).map((filter) => filter.label)
  return selected.length ? `${selected[0]} route` : 'Campus route'
}

export default function Page() {
  const [activeTab, setActiveTab] = useState('Home')
  const [activeLayers, setActiveLayers] = useState<Layer[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [accessibleOnly, setAccessibleOnly] = useState(false)
  const [mapAction, setMapAction] = useState<MapAction | undefined>()
  const [locationError, setLocationError] = useState<string | null>(null)
  const [routes, setRoutes] = useState<Route[]>([])
  const [routesLoaded, setRoutesLoaded] = useState(false)
  const [activeRoute, setActiveRoute] = useState<Route | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null)
  const [routeStart, setRouteStart] = useState('')
  const [routeDestination, setRouteDestination] = useState('')
  const [routeMode, setRouteMode] = useState<TravelMode>('walking')
  const [isRouting, setIsRouting] = useState(false)
  const [routeError, setRouteError] = useState('')
  const suggestions = searchQuery.trim()
    ? buildings.filter((building) => building.name.toLowerCase().includes(searchQuery.trim().toLowerCase())).slice(0, 5)
    : []

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(ROUTES_STORAGE_KEY)
      if (stored) setRoutes(JSON.parse(stored) as Route[])
    } catch {
      setRoutes([])
    } finally {
      setRoutesLoaded(true)
    }
  }, [])

  useEffect(() => {
    if (routesLoaded) window.localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes))
  }, [routes, routesLoaded])

  const triggerMap = (type: MapAction['type']) => setMapAction({ type, id: Date.now() })
  const toggleLayer = (layer: Layer) => setActiveLayers((current) => current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer])
  const addRecent = (route: Route) => setRoutes((current) => [route, ...current.filter((item) => item.id !== route.id)].slice(0, 20))
  const saveCurrentRoute = () => {
    const route: Route = { id: crypto.randomUUID(), name: activeRoute?.name ?? routeName(activeLayers, accessibleOnly), layers: [...activeLayers], accessibleOnly, saved: true, openedAt: Date.now(), start: activeRoute?.start, destination: activeRoute?.destination, mode: activeRoute?.mode, data: activeRoute?.data }
    setRoutes((current) => [route, ...current])
    setActiveRoute(route)
  }
  const generateRoute = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const start = buildings.find((building) => building.name.toLowerCase() === routeStart.trim().toLowerCase())
    const destination = buildings.find((building) => building.name.toLowerCase() === routeDestination.trim().toLowerCase())
    if (!start || !destination) {
      setActiveRoute(null)
      setRouteError('Choose a starting point and destination from the UW building suggestions.')
      return
    }
    if (start.name === destination.name) {
      setActiveRoute(null)
      setRouteError('Choose two different locations to create a route.')
      return
    }

    setIsRouting(true)
    setRouteError('')
    try {
      const boundaryResponse = await fetch('/data/uw-seattle-navigation.geojson')
      if (!boundaryResponse.ok) throw new Error('Campus navigation data could not be loaded.')
      const navigationData = await boundaryResponse.json() as { features?: Array<{ properties?: { kind?: string }; geometry?: CampusBoundary }> }
      const boundaryFeature = navigationData.features?.find((feature) => feature.properties?.kind === 'campus-boundary')
      const boundary = boundaryFeature?.geometry
      if (!boundary || !['Polygon', 'MultiPolygon'].includes(boundary.type)) {
        throw new Error('Routing is unavailable until a verified UW Seattle campus boundary is added to the campus GeoJSON. No route was drawn.')
      }
      if (!isInsideBoundary(start.coordinates, boundary) || !isInsideBoundary(destination.coordinates, boundary)) {
        throw new Error('The start or destination is outside the supported UW Seattle campus area. Choose campus locations inside the configured boundary.')
      }

      const response = await fetch('/api/route', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ start: start.coordinates, destination: destination.coordinates, mode: routeMode }),
      })
      const result = await response.json() as CalculatedRoute & { error?: string }
      if (!response.ok) throw new Error(result.error || 'No mapped route is available between these locations.')
      if (!routeStaysInsideBoundary(result.geometry, boundary)) {
        throw new Error('The mapped route leaves the verified UW Seattle campus boundary. No route was displayed.')
      }
      const route: Route = {
        id: crypto.randomUUID(),
        name: `${start.name} to ${destination.name}`,
        layers: [...activeLayers],
        accessibleOnly,
        saved: false,
        openedAt: Date.now(),
        start,
        destination,
        mode: routeMode,
        data: result,
      }
      setActiveRoute(route)
      addRecent(route)
    } catch (error) {
      setActiveRoute(null)
      setRouteError(error instanceof Error ? error.message : 'Unable to calculate this route. Please try again.')
    } finally {
      setIsRouting(false)
    }
  }
  const openRoute = (route: Route) => {
    setActiveLayers(route.layers)
    setAccessibleOnly(route.accessibleOnly)
    setActiveRoute(route)
    setActiveTab('Home')
    setShowFilters(false)
    setLocationError(null)
    addRecent({ ...route, openedAt: Date.now() })
  }
  const toggleSaved = (route: Route) => setRoutes((current) => current.map((item) => item.id === route.id ? { ...item, saved: !item.saved } : item))
  const savedRoutes = routes.filter((route) => route.saved)
  const recentRoutes = [...routes].sort((a, b) => b.openedAt - a.openedAt).slice(0, 8)

  return (
    <main className="prototype-shell">
      <header className="prototype-header">
        <nav className="prototype-nav" aria-label="Primary navigation">
          {[
            { label: 'Home', icon: HomeIcon },
            { label: 'Routes', icon: MapIcon },
          ].map(({ label, icon: Icon }) => (
            <button key={label} className={activeTab === label ? 'nav-pill active' : 'nav-pill'} onClick={() => setActiveTab(label)} aria-current={activeTab === label ? 'page' : undefined}>
              <Icon aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>
        <button className="mobile-icon-button" aria-label="Open menu"><Menu /></button>
      </header>

      <aside className="prototype-sidebar">
        <section className="prototype-intro">
          <h1>Last Mile Navigator</h1>
          <p>{activeTab === 'Routes' ? 'Your saved and recent campus routes' : 'Pedestrian and bicycle routes · UW Seattle'}</p>
          <div className="search-area">
            <label className="prototype-search">
              <Menu aria-hidden="true" />
              <span className="sr-only">Search UW Seattle buildings</span>
              <input
                placeholder="Search UW buildings"
                aria-label="Search UW Seattle buildings"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
                aria-controls="building-suggestions"
                value={searchQuery}
                onChange={(event) => { setSearchQuery(event.target.value); setSelectedBuilding(null) }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setSearchQuery('')
                  if (event.key === 'Enter' && suggestions[0]) {
                    event.preventDefault()
                    setSelectedBuilding(suggestions[0])
                    setSearchQuery(suggestions[0].name)
                  }
                }}
              />
              <Search aria-hidden="true" />
            </label>
            {suggestions.length > 0 && (
              <ul id="building-suggestions" className="building-suggestions" role="listbox" aria-label="UW building suggestions">
                {suggestions.map((building) => (
                  <li key={building.name} role="option" aria-selected={selectedBuilding?.name === building.name}>
                    <button type="button" onClick={() => { setSelectedBuilding(building); setSearchQuery(building.name) }}>{building.name}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {activeTab !== 'Routes' && (
            <>
              <form className="create-route-form" onSubmit={generateRoute} aria-label="Create a campus route">
                <h2>Create route</h2>
                <label htmlFor="route-start">Starting location</label>
                <input id="route-start" name="start" list="uw-building-options" autoComplete="off" value={routeStart} onChange={(event) => setRouteStart(event.target.value)} placeholder="Choose a UW building" required />
                <label htmlFor="route-destination">Destination</label>
                <input id="route-destination" name="destination" list="uw-building-options" autoComplete="off" value={routeDestination} onChange={(event) => setRouteDestination(event.target.value)} placeholder="Choose a UW building" required />
                <label htmlFor="route-mode">Travel mode</label>
                <select id="route-mode" value={routeMode} onChange={(event) => setRouteMode(event.target.value as TravelMode)} disabled={isRouting}>
                  <option value="walking">Walking</option>
                  <option value="scooter">Lime scooter (bicycle routing)</option>
                </select>
                <datalist id="uw-building-options">
                  {buildings.map((building) => <option key={building.name} value={building.name} />)}
                </datalist>
                {routeError && <p className="route-form-error" role="alert">{routeError}</p>}
                <button type="submit" className="create-route-submit" disabled={isRouting}>{isRouting ? 'Finding mapped route…' : 'Generate route'}</button>
              </form>
              <button className="route-preview" onClick={saveCurrentRoute}><span className="route-icon"><Navigation /></span><span><strong>{activeRoute?.start ? 'Save this route' : activeRoute ? 'Save another route' : 'Save current route'}</strong><small>{activeRoute ? `${activeRoute.name} · ` : ''}{activeLayers.length + (accessibleOnly ? 1 : 0)} route filters · saved on this device</small></span><Heart aria-hidden="true" /></button>
              {activeRoute?.data && (
                <section className="route-details" aria-label="Calculated route details">
                  <h2>{activeRoute.mode === 'scooter' ? 'Bicycle route for Lime scooter' : 'Walking route'}</h2>
                  <p><strong>{activeRoute.data.distance.toFixed(2)} km</strong><span aria-hidden="true"> · </span>about {formatDuration(activeRoute.data.time)}</p>
                  <ol>{activeRoute.data.directions.map((step, index) => <li key={`${index}-${step.instruction}`}><span>{step.instruction}</span><small>{step.distance.toFixed(2)} km · {formatDuration(step.time)}</small></li>)}</ol>
                </section>
              )}
            </>
          )}
        </section>
        {activeTab === 'Routes' && (
          <section className="prototype-bottom-sheet routes-sheet" aria-label="Saved and recent routes">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-heading"><div><p className="section-label">ROUTE LIBRARY</p><h2>Your routes</h2></div></div>
            <div className="route-list-scroll">
              <h3 className="route-group-title">Saved <span>{savedRoutes.length}</span></h3>
              {savedRoutes.length ? savedRoutes.map((route) => <RouteCard key={`saved-${route.id}`} route={route} onOpen={openRoute} onToggleSaved={toggleSaved} />) : <p className="route-empty">Save a route from Home to find it here.</p>}
              <h3 className="route-group-title recent-title">Recent <span>{recentRoutes.length}</span></h3>
              {recentRoutes.length ? recentRoutes.map((route) => <RouteCard key={`recent-${route.id}`} route={route} onOpen={openRoute} onToggleSaved={toggleSaved} />) : <p className="route-empty">Routes you open will appear here.</p>}
            </div>
          </section>
        )}
      </aside>

      <section className="prototype-map-section" aria-label="UW Seattle campus map">
        <CampusMap activeLayers={activeLayers} action={mapAction} onLocationError={setLocationError} route={activeRoute} destination={selectedBuilding} />
        <div className="map-bottom-stack">
          <MapLegend activeLayers={activeLayers} route={activeRoute} />
          {locationError && <p className="location-status" role="status">{locationError}</p>}
        </div>
        <div className="prototype-map-controls">
          <button className="filter-pill" onClick={() => setShowFilters((current) => !current)} aria-expanded={showFilters}><Filter aria-hidden="true" /> Filter{activeLayers.length > 0 ? ` · ${activeLayers.length}` : ''}</button>
          <button className={accessibleOnly ? 'accessibility-button selected' : 'accessibility-button'} onClick={() => setAccessibleOnly((current) => !current)} aria-pressed={accessibleOnly} aria-label="Toggle accessible routes"><Accessibility aria-hidden="true" /></button>
        </div>
        <div className="prototype-zoom-controls" aria-label="Map zoom controls"><button onClick={() => triggerMap('zoom-in')} aria-label="Zoom in">+</button><button onClick={() => triggerMap('zoom-out')} aria-label="Zoom out">−</button><button onClick={() => triggerMap('locate')} aria-label="Find my location"><Crosshair /></button></div>
      </section>

      {showFilters && <section className="prototype-filter-panel" aria-label="Map filters">
        <div className="filter-panel-heading"><div><p className="section-label">MAP FILTERS</p><h2>Show on map</h2></div><button className="close-filter" onClick={() => setShowFilters(false)} aria-label="Close filters"><X /></button></div>
        <p className="filter-help">Toggle layers to highlight accessibility details on the map.</p>
        {filters.map((filter) => <button key={filter.id} className={activeLayers.includes(filter.id) ? `filter-option active ${filter.tone}` : `filter-option ${filter.tone}`} onClick={() => toggleLayer(filter.id)} aria-pressed={activeLayers.includes(filter.id)}><span className={`filter-swatch ${filter.tone}`} /><span className="filter-copy"><span className="filter-label">{filter.label}</span><span className="filter-description">{filter.description}</span></span><span className={activeLayers.includes(filter.id) ? 'filter-check checked' : 'filter-check'} aria-hidden="true">{activeLayers.includes(filter.id) ? '✓' : ''}</span></button>)}
      </section>}
    </main>
  )
}

function RouteCard({ route, onOpen, onToggleSaved }: { route: Route; onOpen: (route: Route) => void; onToggleSaved: (route: Route) => void }) {
  const filterLabels = filters.filter((filter) => route.layers.includes(filter.id)).map((filter) => filter.label)
  if (route.accessibleOnly) filterLabels.unshift('Accessible only')
  return (
    <article className="route-card">
      <button className="route-card-open" onClick={() => onOpen(route)} aria-label={`Open ${route.name} on map`}>
        <span className="route-card-icon"><Navigation aria-hidden="true" /></span>
        <span className="route-card-copy"><strong>{route.name}</strong><small>{filterLabels.length ? filterLabels.join(' · ') : 'No extra filters'}</small></span>
      </button>
      <button className={route.saved ? 'route-favorite is-saved' : 'route-favorite'} onClick={() => onToggleSaved(route)} aria-label={route.saved ? `Remove ${route.name} from saved routes` : `Save ${route.name}`} aria-pressed={route.saved}><Heart aria-hidden="true" fill={route.saved ? 'currentColor' : 'none'} /></button>
    </article>
  )
}

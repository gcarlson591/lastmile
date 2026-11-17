'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Crosshair, Filter, Heart, Menu, Navigation, Search, Map as MapIcon, Home as HomeIcon, X, Pencil } from 'lucide-react'
import { CampusMap } from '@/components/campus-map'
import { MapLegend } from '@/components/map-legend'

type Layer = 'no-go' | 'lime-parking' | 'terrain' | 'parking'
type MapAction = { type: 'zoom-in' | 'zoom-out' | 'locate'; id: number }
type Building = { name: string; coordinates: [number, number] }
type RouteMode = 'walking' | 'bicycling' | 'lime'
type Route = { id: string; name: string; mode?: RouteMode; layers: Layer[]; accessibleOnly: boolean; saved: boolean; openedAt: number; start?: Building; destination?: Building; geometry?: [number, number][]; distanceKm?: number; durationMinutes?: number }
const routeModes: { id: RouteMode; label: string }[] = [
  { id: 'walking', label: 'Walking' },
  { id: 'bicycling', label: 'Bicycling' },
  { id: 'lime', label: 'Lime scooter' },
]
const ROUTES_STORAGE_KEY = 'lastmile-routes-v1'

const buildings: Building[] = [
  { name: 'Suzzallo Library', coordinates: [47.6553, -122.308] },
  { name: 'Husky Union Building (HUB)', coordinates: [47.6557, -122.305] },
  { name: 'Mary Gates Hall', coordinates: [47.6566, -122.3087] },
  { name: 'Kane Hall', coordinates: [47.6562, -122.307] },
  { name: 'Odegaard Undergraduate Library', coordinates: [47.6557, -122.3095] },
  { name: 'Paul G. Allen Center', coordinates: [47.6536, -122.305] },
  { name: 'The Quad', coordinates: [47.6566, -122.31] },
  { name: 'IMA', coordinates: [47.653, -122.301] },
  { name: 'Red Square', coordinates: [47.6558, -122.307] },
]

const filters: { id: Layer; label: string; description: string; tone: string }[] = [
  { id: 'no-go', label: 'Lime no-go zones', description: "Show zones where Lime bikes and scooters won't work and cannot be parked in", tone: 'coral' },
  { id: 'lime-parking', label: 'Lime parking areas', description: 'Show zones where Lime bikes and scooters can be parked', tone: 'green' },
  { id: 'terrain', label: 'Stairs & slopes', description: 'Show stairs and slopes', tone: 'amber' },
  { id: 'parking', label: 'Parking areas', description: 'Show car parking areas', tone: 'blue' },
]

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
  const [routeMode, setRouteMode] = useState<RouteMode>('walking')
  const [isRouting, setIsRouting] = useState(false)
  const [routeError, setRouteError] = useState('')
  const campusBuildingQuery = '[out:json][timeout:20];(way["building"]["name"](47.648, -122.323, 47.662, -122.292);relation["building"]["name"](47.648, -122.323, 47.662, -122.292););out center tags;'
  const { data: openMapBuildings } = useSWR(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(campusBuildingQuery)}`, async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Building lookup failed')
    const data = await response.json() as { elements?: { tags?: { name?: string }; lat?: number; lon?: number; center?: { lat: number; lon: number } }[] }
    return (data.elements ?? []).flatMap((element) => {
      const name = element.tags?.name
      const position = element.center ?? (element.lat !== undefined && element.lon !== undefined ? { lat: element.lat, lon: element.lon } : undefined)
      return name && position ? [{ name, coordinates: [position.lat, position.lon] as [number, number] }] : []
    })
  }, { revalidateOnFocus: false })
  const campusBuildings = [...new Map([...buildings, ...(openMapBuildings ?? [])].map((building) => [building.name.toLowerCase(), building])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const [startSuggestionsOpen, setStartSuggestionsOpen] = useState(false)
  const [destinationSuggestionsOpen, setDestinationSuggestionsOpen] = useState(false)
  const suggestions = searchQuery.trim()
    ? campusBuildings.filter((building) => building.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : []
  const matchingBuildings = (value: string) => value.trim()
    ? campusBuildings.filter((building) => building.name.toLowerCase().includes(value.trim().toLowerCase()))
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
  const routeKey = (route: Route) => route.start && route.destination
    ? `${route.start.name.toLowerCase()}|${route.destination.name.toLowerCase()}|${route.mode ?? 'walking'}|${[...route.layers].sort().join(',')}|${route.accessibleOnly}`
    : `${route.name.toLowerCase()}|${route.mode ?? 'walking'}|${[...route.layers].sort().join(',')}|${route.accessibleOnly}`
  const isAlreadySaved = Boolean(activeRoute && routes.some((route) => route.saved && routeKey(route) === routeKey(activeRoute)))
  const saveCurrentRoute = () => {
    if (!activeRoute || isAlreadySaved) return
    const route: Route = { ...activeRoute, id: crypto.randomUUID(), saved: true, openedAt: Date.now() }
    setRoutes((current) => [route, ...current])
    setActiveRoute(route)
  }
  const generateRoute = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const start = campusBuildings.find((building) => building.name.toLowerCase() === routeStart.trim().toLowerCase())
    const destination = campusBuildings.find((building) => building.name.toLowerCase() === routeDestination.trim().toLowerCase())
    if (!start || !destination) {
      setRouteError('Choose a starting point and destination from the UW building suggestions.')
      return
    }
    if (start.name === destination.name) {
      setRouteError('Choose two different locations to create a route.')
      return
    }

    setIsRouting(true)
    setRouteError('Requesting a mapped route from Valhalla…')
    try {
      const response = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: routeMode,
          start: { lat: start.coordinates[0], lon: start.coordinates[1] },
          destination: { lat: destination.coordinates[0], lon: destination.coordinates[1] },
        }),
      })
      const result = await response.json() as { error?: string; geometry?: [number, number][]; distanceKm?: number; durationMinutes?: number }
      if (!response.ok || !result.geometry?.length) throw new Error(result.error ?? 'Valhalla did not return a route.')
      const route: Route = { id: crypto.randomUUID(), name: `${start.name} to ${destination.name}`, mode: routeMode, layers: [...activeLayers], accessibleOnly, saved: false, openedAt: Date.now(), start, destination, geometry: result.geometry, distanceKm: result.distanceKm, durationMinutes: result.durationMinutes }
      setRouteError('')
      setActiveRoute(route)
      addRecent(route)
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'Could not find a route. Check the Valhalla server and try again.')
    } finally {
      setIsRouting(false)
    }
  }
  const openRoute = (route: Route) => {
    setActiveLayers(route.layers)
    setAccessibleOnly(route.accessibleOnly)
    setRouteMode(route.mode ?? 'walking')
    setActiveRoute(route)
    setActiveTab('Home')
    setShowFilters(false)
    setLocationError(null)
    addRecent({ ...route, openedAt: Date.now() })
  }
  const toggleSaved = (route: Route) => setRoutes((current) => current.map((item) => item.id === route.id ? { ...item, saved: !item.saved } : item))
  const renameRoute = (route: Route, name: string) => setRoutes((current) => current.map((item) => item.id === route.id ? { ...item, name } : item))
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
          <p>{activeTab === 'Routes' ? 'Your saved and recent campus routes' : 'Find the best accessible routes across campus'}</p>
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
                <fieldset className="route-mode-fieldset">
                  <legend>Travel mode</legend>
                  <div className="route-mode-options">
                    {routeModes.map((mode) => (
                      <label key={mode.id} className={routeMode === mode.id ? 'route-mode-option selected' : 'route-mode-option'}>
                        <input type="radio" name="route-mode" value={mode.id} checked={routeMode === mode.id} onChange={() => setRouteMode(mode.id)} />
                        <span>{mode.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {routeMode === 'lime' && <p className="lime-routing-note">Uses Valhalla&apos;s motor-scooter access rules with a 25 mph speed ceiling. Shared paths require explicit scooter access in OSM; incomplete tags mean route legality and posted road limits are not independently verified.</p>}
                <label htmlFor="route-start">Starting location</label>
                <div className="route-location-field">
                  <input id="route-start" name="start" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={startSuggestionsOpen && matchingBuildings(routeStart).length > 0} aria-controls="route-start-options" value={routeStart} onFocus={() => setStartSuggestionsOpen(true)} onChange={(event) => { setRouteStart(event.target.value); setStartSuggestionsOpen(true) }} placeholder="Choose a UW building" required />
                  {startSuggestionsOpen && matchingBuildings(routeStart).length > 0 && <ul className="route-autocomplete" id="route-start-options" role="listbox">{matchingBuildings(routeStart).map((building) => <li key={building.name}><button type="button" role="option" onClick={() => { setRouteStart(building.name); setStartSuggestionsOpen(false) }}>{building.name}</button></li>)}</ul>}
                  {startSuggestionsOpen && <button className="autocomplete-dismiss" type="button" onClick={() => setStartSuggestionsOpen(false)}>Use typed location</button>}
                </div>
                <label htmlFor="route-destination">Destination</label>
                <div className="route-location-field">
                  <input id="route-destination" name="destination" autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={destinationSuggestionsOpen && matchingBuildings(routeDestination).length > 0} aria-controls="route-destination-options" value={routeDestination} onFocus={() => setDestinationSuggestionsOpen(true)} onChange={(event) => { setRouteDestination(event.target.value); setDestinationSuggestionsOpen(true) }} placeholder="Choose a UW building" required />
                  {destinationSuggestionsOpen && matchingBuildings(routeDestination).length > 0 && <ul className="route-autocomplete" id="route-destination-options" role="listbox">{matchingBuildings(routeDestination).map((building) => <li key={building.name}><button type="button" role="option" onClick={() => { setRouteDestination(building.name); setDestinationSuggestionsOpen(false) }}>{building.name}</button></li>)}</ul>}
                  {destinationSuggestionsOpen && <button className="autocomplete-dismiss" type="button" onClick={() => setDestinationSuggestionsOpen(false)}>Use typed location</button>}
                </div>
                {routeError && <p className="route-form-error" role="alert">{routeError}</p>}
                <button type="submit" className="create-route-submit" disabled={isRouting}>{isRouting ? 'Finding route…' : 'Generate route'}</button>
              </form>
              <button className="route-preview" onClick={saveCurrentRoute} disabled={!activeRoute || isAlreadySaved}><span className="route-icon"><Navigation /></span><span><strong>{isAlreadySaved ? 'Route already saved' : activeRoute ? 'Save this route' : 'Create a route to save'}</strong><small>{activeRoute ? `${routeModes.find((mode) => mode.id === (activeRoute.mode ?? 'walking'))?.label ?? 'Walking'} · ${activeRoute.distanceKm !== undefined ? `${activeRoute.distanceKm.toFixed(1)} km · ` : ''}${activeRoute.durationMinutes !== undefined ? `${activeRoute.durationMinutes} min · ` : ''}` : ''}{activeLayers.length + (accessibleOnly ? 1 : 0)} route filters · saved on this device</small></span><Heart aria-hidden="true" /></button>
            </>
          )}
        </section>
        {activeTab === 'Routes' && (
          <section className="prototype-bottom-sheet routes-sheet" aria-label="Saved and recent routes">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-heading"><div><p className="section-label">ROUTE LIBRARY</p><h2>Your routes</h2></div></div>
            <div className="route-list-scroll">
              <h3 className="route-group-title">Saved <span>{savedRoutes.length}</span></h3>
              {savedRoutes.length ? savedRoutes.map((route) => <RouteCard key={`saved-${route.id}`} route={route} onOpen={openRoute} onToggleSaved={toggleSaved} onRename={renameRoute} />) : <p className="route-empty">Save a route from Home to find it here.</p>}
              <h3 className="route-group-title recent-title">Recent <span>{recentRoutes.length}</span></h3>
              {recentRoutes.length ? recentRoutes.map((route) => <RouteCard key={`recent-${route.id}`} route={route} onOpen={openRoute} onToggleSaved={toggleSaved} onRename={renameRoute} />) : <p className="route-empty">Routes you open will appear here.</p>}
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

function RouteCard({ route, onOpen, onToggleSaved, onRename }: { route: Route; onOpen: (route: Route) => void; onToggleSaved: (route: Route) => void; onRename: (route: Route, name: string) => void }) {
  const filterLabels = [routeModes.find((mode) => mode.id === (route.mode ?? 'walking'))?.label ?? 'Walking', ...filters.filter((filter) => route.layers.includes(filter.id)).map((filter) => filter.label)]
  if (route.accessibleOnly) filterLabels.unshift('Accessible only')
  return (
    <article className="route-card">
      <button className="route-card-open" onClick={() => onOpen(route)} aria-label={`Open ${route.name} on map`}>
        <span className="route-card-icon"><Navigation aria-hidden="true" /></span>
        <span className="route-card-copy"><strong>{route.name}</strong><small>{filterLabels.length ? filterLabels.join(' · ') : 'No extra filters'}</small></span>
      </button>
      {route.saved && <button className="route-rename" onClick={() => { const name = window.prompt('Rename saved route', route.name)?.trim(); if (name) onRename(route, name) }} aria-label={`Rename ${route.name}`}><Pencil aria-hidden="true" /></button>}
      <button className={route.saved ? 'route-favorite is-saved' : 'route-favorite'} onClick={() => onToggleSaved(route)} aria-label={route.saved ? `Remove ${route.name} from saved routes` : `Save ${route.name}`} aria-pressed={route.saved}><Heart aria-hidden="true" fill={route.saved ? 'currentColor' : 'none'} /></button>
    </article>
  )
}

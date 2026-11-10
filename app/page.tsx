'use client'

import { useState } from 'react'
import { Accessibility, ChevronDown, Crosshair, Filter, Menu, Navigation, Search, UserRound, Map as MapIcon, Home as HomeIcon, X } from 'lucide-react'
import { CampusMap } from '@/components/campus-map'

type Layer = 'all' | 'no-go' | 'terrain' | 'parking'

const filters: { id: Layer; label: string; tone: string }[] = [
  { id: 'no-go', label: 'Lime no-go zones', tone: 'coral' },
  { id: 'terrain', label: 'Stairs & slopes', tone: 'amber' },
  { id: 'parking', label: 'Parking areas', tone: 'blue' },
]

export default function Page() {
  const [activeTab, setActiveTab] = useState('Home')
  const [activeLayer, setActiveLayer] = useState<Layer>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [accessibleOnly, setAccessibleOnly] = useState(false)

  return (
    <main className="prototype-shell">
      <header className="prototype-header">
        <nav className="prototype-nav" aria-label="Primary navigation">
          {[
            { label: 'Home', icon: HomeIcon },
            { label: 'Routes', icon: MapIcon },
            { label: 'Profile', icon: UserRound },
          ].map(({ label, icon: Icon }) => (
            <button key={label} className={activeTab === label ? 'nav-pill active' : 'nav-pill'} onClick={() => setActiveTab(label)} aria-current={activeTab === label ? 'page' : undefined}>
              <Icon aria-hidden="true" /> {label}
            </button>
          ))}
        </nav>
        <button className="mobile-icon-button" aria-label="Open menu"><Menu /></button>
      </header>

      <section className="prototype-intro">
        <h1>Last Mile Navigator</h1>
        <p>Find the best accessible routes across campus</p>
        <label className="prototype-search">
          <Menu aria-hidden="true" />
          <span className="sr-only">Search last mile navigator</span>
          <input placeholder="Search Last Mile Navigator" aria-label="Search Last Mile Navigator" />
          <Search aria-hidden="true" />
        </label>
      </section>

      <section className="prototype-map-section" aria-label="UW Seattle campus map">
        <CampusMap activeLayer={activeLayer} />
        <div className="prototype-map-controls">
          <button className="filter-pill" onClick={() => setShowFilters((current) => !current)} aria-expanded={showFilters}><Filter aria-hidden="true" /> Filter</button>
          <button className={accessibleOnly ? 'accessibility-button selected' : 'accessibility-button'} onClick={() => setAccessibleOnly((current) => !current)} aria-pressed={accessibleOnly} aria-label="Toggle accessible routes"><Accessibility aria-hidden="true" /></button>
        </div>
        <div className="prototype-zoom-controls" aria-label="Map zoom controls"><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button></div>
      </section>

      {showFilters && <section className="prototype-filter-panel" aria-label="Map filters">
        <div className="filter-panel-heading"><div><p className="section-label">MAP FILTERS</p><h2>Show on map</h2></div><button className="close-filter" onClick={() => setShowFilters(false)} aria-label="Close filters"><X /></button></div>
        <button className={activeLayer === 'all' ? 'filter-option active' : 'filter-option'} onClick={() => setActiveLayer('all')}><span className="filter-swatch all-swatch" />All map information</button>
        {filters.map((filter) => <button key={filter.id} className={activeLayer === filter.id ? `filter-option active ${filter.tone}` : `filter-option ${filter.tone}`} onClick={() => setActiveLayer(filter.id)}><span className={`filter-swatch ${filter.tone}`} />{filter.label}<ChevronDown aria-hidden="true" /></button>)}
      </section>}

      <section className="prototype-bottom-sheet" aria-label="Navigation summary">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-heading"><div><p className="section-label">NEAR YOU</p><h2>Explore UW Seattle</h2></div><button className="locate-button" aria-label="Locate me"><Crosshair /></button></div>
        <button className="route-preview"><span className="route-icon"><Navigation /></span><span><strong>Plan an accessible route</strong><small>Choose a start and destination</small></span><ChevronDown aria-hidden="true" /></button>
      </section>
    </main>
  )
}

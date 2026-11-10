'use client'

import { useState } from 'react'
import { CampusMap } from '@/components/campus-map'
import { ArrowRight, ChevronDown, CircleHelp, Clock3, Crosshair, Footprints, MapPin, Menu, Navigation, Search, SlidersHorizontal, Sparkles, TrainFront, Accessibility, X } from 'lucide-react'

type Layer = 'all' | 'no-go' | 'terrain' | 'parking'

const filters = [
  { id: 'no-go' as Layer, label: 'Lime no-go zones', icon: '◉', tone: 'coral' },
  { id: 'terrain' as Layer, label: 'Stairs & slopes', icon: '≋', tone: 'amber' },
  { id: 'parking' as Layer, label: 'Parking areas', icon: 'P', tone: 'blue' },
]

export default function Page() {
  const [activeLayer, setActiveLayer] = useState<Layer>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [destination, setDestination] = useState('Suzzallo Library')

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark" aria-hidden="true">U</div><div><p className="brand-title">Wayfinder</p><p className="brand-subtitle">UW Seattle • accessible routes</p></div></div>
        <nav aria-label="Primary navigation" className="desktop-nav"><a href="#plan">Plan a route</a><a href="#map">Explore map</a><a href="#about">About the project</a></nav>
        <button className="icon-button mobile-menu" aria-label="Open menu"><Menu /></button>
        <button className="help-button"><CircleHelp /> <span>Help & feedback</span></button>
      </header>

      <section className="hero" id="plan">
        <div className="hero-copy"><p className="eyebrow"><Sparkles /> DESIGNED FOR EVERY BODY</p><h1>Move through campus<br /><em>with confidence.</em></h1><p className="hero-description">Find a route that works for you. Wayfinder combines campus information, mobility resources, and accessibility details in one place.</p></div>
        <div className="route-panel" aria-label="Route planner">
          <div className="panel-heading"><div><p className="panel-kicker">PLAN YOUR JOURNEY</p><h2>Where would you like to go?</h2></div><button className="filter-trigger" onClick={() => setShowFilters(!showFilters)} aria-expanded={showFilters}><SlidersHorizontal /> Preferences</button></div>
          <div className="route-inputs"><label className="route-field"><span className="route-dot origin" aria-hidden="true" /><span className="sr-only">Starting location</span><input defaultValue="University Village" aria-label="Starting location" /><Crosshair className="field-action" aria-hidden="true" /></label><div className="route-line" aria-hidden="true" /><label className="route-field"><span className="route-dot destination" aria-hidden="true" /><span className="sr-only">Destination</span><input value={destination} onChange={(event) => setDestination(event.target.value)} aria-label="Destination" /><Search className="field-action" aria-hidden="true" /></label></div>
          {showFilters && <div className="preference-row"><span className="preference-label">I prefer routes with:</span><button className="preference active"><Accessibility /> Step-free paths</button><button className="preference"><Footprints /> Lower slopes</button><button className="preference"><TrainFront /> Transit nearby</button></div>}
          <div className="panel-actions"><button className="advanced-link" onClick={() => setShowFilters(!showFilters)}>Accessibility preferences <ChevronDown /></button><button className="primary-button" onClick={() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })}>Find accessible routes <ArrowRight /></button></div>
        </div>
      </section>

      <section className="map-section" id="map"><div className="map-header"><div><p className="eyebrow">EXPLORE THE CAMPUS</p><h2>University of Washington, Seattle</h2></div><div className="map-actions"><button className="map-action"><MapPin /> Locate me</button><button className="map-action"><Navigation /> Directions</button></div></div><div className="map-frame"><CampusMap activeLayer={activeLayer} /><div className="map-overlay"><div className="map-search"><Search /><input aria-label="Search campus map" placeholder="Search campus places" /></div><div className="layer-control" aria-label="Map layer filters"><button className={activeLayer === 'all' ? 'layer active' : 'layer'} onClick={() => setActiveLayer('all')}>All layers</button>{filters.map((filter) => <button key={filter.id} className={activeLayer === filter.id ? `layer active ${filter.tone}` : `layer ${filter.tone}`} onClick={() => setActiveLayer(filter.id)}><span aria-hidden="true">{filter.icon}</span>{filter.label}</button>)}</div><div className="map-legend"><p>MAP LEGEND</p>{filters.map((filter) => <div key={filter.id}><span className={`legend-dot ${filter.tone}`} aria-hidden="true" />{filter.label}</div>)}</div></div></div></section>

      <section className="results-section" id="results"><div className="results-heading"><div><p className="eyebrow">YOUR ROUTE OPTIONS</p><h2>Routes to {destination || 'your destination'}</h2></div><button className="sort-button">Recommended <ChevronDown /></button></div><div className="route-cards"><article className="route-card recommended"><div className="route-card-top"><span className="recommended-badge">BEST MATCH</span><span className="route-time"><Clock3 /> 18 min</span></div><h3>Step-free campus route</h3><p className="route-meta">0.8 mi <span>•</span> Mostly paved <span>•</span> 2% max slope</p><div className="route-progress"><span className="progress-green" /><span className="progress-blue" /><span className="progress-gray" /></div><div className="route-card-bottom"><span><Accessibility /> Fully step-free</span><button className="text-button">View details <ArrowRight /></button></div></article><article className="route-card"><div className="route-card-top"><span className="route-type">ALTERNATIVE</span><span className="route-time"><Clock3 /> 12 min</span></div><h3>Ride + accessible entrance</h3><p className="route-meta">Lime scooter <span>•</span> 2 min walk <span>•</span> Check no-go zones</p><div className="route-card-bottom"><span><MapPin /> Parking dock near destination</span><button className="text-button">View details <ArrowRight /></button></div></article></div></section>

      <footer id="about"><div className="footer-brand"><div className="brand-mark">U</div><div><strong>Wayfinder</strong><span>Built for a more accessible UW</span></div></div><div className="footer-links"><a href="#about">About OpenSidewalks</a><a href="#about">Report an issue</a><a href="#about">Accessibility statement</a></div><p className="footer-note">Data is community-informed and updated regularly. Always use your best judgment while navigating.</p></footer>
    </main>
  )
}

'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { mapSymbols, symbolBadgeHtml, type MapLayer } from '@/lib/map-symbols'

export function MapLegend({ activeLayers, route }: { activeLayers: MapLayer[]; route?: { accessibleOnly: boolean; mode?: 'walking' | 'bicycling' | 'lime' } | null }) {
  const [collapsed, setCollapsed] = useState(false)
  const visibleSymbols = mapSymbols.filter((symbol) => activeLayers.includes(symbol.layer))
  if (!visibleSymbols.length && !route) return null

  return (
    <section className="map-legend" aria-label="Map key">
      <button className="map-legend-toggle" onClick={() => setCollapsed((current) => !current)} aria-expanded={!collapsed} aria-controls="map-legend-list">
        <span>Map key</span>
        <ChevronDown aria-hidden="true" className={collapsed ? 'is-collapsed' : undefined} />
      </button>
      {!collapsed && (
        <ul id="map-legend-list" className="map-legend-list">
          {visibleSymbols.map((symbol) => (
            <li key={symbol.id} className="map-legend-item">
              <span className={`legend-sample ${symbol.kind}`} style={{ '--symbol-color': symbol.color, '--symbol-fill': symbol.fill } as React.CSSProperties}>
                <span dangerouslySetInnerHTML={{ __html: symbolBadgeHtml(symbol) }} />
              </span>
              <span className="legend-copy"><strong>{symbol.label}</strong><small>{symbol.detail}</small></span>
            </li>
          ))}
          {route && (
            <li className="map-legend-item">
              <span className={`legend-sample ${route.mode === 'lime' ? 'lime-route' : route.mode === 'bicycling' ? 'bicycling-route' : 'walking-route'}`} aria-hidden="true" />
              <span className="legend-copy"><strong>{route.mode === 'lime' ? 'Lime scooter route' : route.mode === 'bicycling' ? 'Bicycling route' : 'Walking route'}</strong><small>Mapped OpenStreetMap network · Valhalla</small></span>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}

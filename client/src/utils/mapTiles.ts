/** Esri World Street Map. OSMF public tiles block apps; CARTO now watermarks without an API key. */
export function mapTileUrl(_dark = false) {
  return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
}

export function mapTileAttribution(_dark = false) {
  return "Tiles &copy; Esri &mdash; Source: Esri, OpenStreetMap";
}

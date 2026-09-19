/** Esri World Street Map. OSMF public tiles block apps; CARTO watermarks without a key. Street coverage in Bengaluru stops around zoom 17. */
export function mapTileUrl(_dark = false) {
  return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";
}

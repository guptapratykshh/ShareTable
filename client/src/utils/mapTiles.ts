export function mapTileUrl(dark: boolean) {
  return dark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
}

export function mapTileAttribution(dark: boolean) {
  return dark
    ? '&copy; OpenStreetMap &copy; CARTO'
    : '&copy; OpenStreetMap contributors';
}

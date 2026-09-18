import { TileLayer } from "react-leaflet";
import { useTheme } from "../context/ThemeContext";
import { mapTileAttribution, mapTileUrl } from "../utils/mapTiles";

export function ThemedTileLayer() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <TileLayer
      key="esri-street"
      attribution={mapTileAttribution(dark)}
      url={mapTileUrl(dark)}
      maxZoom={19}
    />
  );
}

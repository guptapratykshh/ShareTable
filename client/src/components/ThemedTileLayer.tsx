import { TileLayer } from "react-leaflet";
import { useTheme } from "../context/ThemeContext";
import { mapTileUrl } from "../utils/mapTiles";

export function ThemedTileLayer() {
  const { theme } = useTheme();
  const dark = theme === "dark";
  return (
    <TileLayer
      key="esri-street"
      attribution=""
      url={mapTileUrl(dark)}
      maxNativeZoom={17}
      maxZoom={17}
    />
  );
}

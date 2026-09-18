import { CircleMarker, MapContainer, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ThemedTileLayer } from "./ThemedTileLayer";

export type RescueLiveMarker = {
  id: string;
  liveState: "ACTIVE" | "URGENT" | "RESCUED";
  liveStateLabel: string;
  meals: number;
  lat: number;
  lng: number;
};

const STATE_COLOR: Record<RescueLiveMarker["liveState"], string> = {
  RESCUED: "#2d6a4f",
  ACTIVE: "#b5651d",
  URGENT: "#9b2226",
};

export function RescueMap({
  center,
  markers,
}: {
  center: { lat: number; lng: number };
  markers: RescueLiveMarker[];
}) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={13} className="h-full w-full">
      <ThemedTileLayer />
      {markers.map((d) => (
        <CircleMarker
          key={d.id}
          center={[d.lat, d.lng]}
          radius={10}
          pathOptions={{ color: STATE_COLOR[d.liveState], fillColor: STATE_COLOR[d.liveState], fillOpacity: 0.85 }}
        >
          <Popup>
            <p className="font-semibold">{d.liveStateLabel}</p>
            <p>{d.meals} meals</p>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}

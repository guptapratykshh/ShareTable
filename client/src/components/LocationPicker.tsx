import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type Loc = { lat: number; lng: number };

function Recenter({ value }: { value: Loc }) {
  const map = useMap();
  useEffect(() => {
    map.setView([value.lat, value.lng], map.getZoom());
  }, [map, value.lat, value.lng]);
  return null;
}

function ClickCapture({ onChange }: { onChange: (loc: Loc) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: Loc;
  onChange: (loc: Loc) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="h-56 overflow-hidden rounded-[1.5rem] border border-border">
        <MapContainer center={[value.lat, value.lng]} zoom={14} className="h-full w-full" scrollWheelZoom>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[value.lat, value.lng]} icon={icon} />
          <ClickCapture onChange={onChange} />
          <Recenter value={value} />
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          className="rounded-full border border-border px-3 py-1.5 font-medium hover:bg-secondary"
          onClick={() => {
            navigator.geolocation.getCurrentPosition(
              (pos) => onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => undefined,
            );
          }}
        >
          Use my location
        </button>
        <span className="text-muted">
          {value.lat.toFixed(4)}, {value.lng.toFixed(4)}. Click the map to move the pin.
        </span>
      </div>
    </div>
  );
}

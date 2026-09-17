import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { inputClass } from "./Form";
import { reverseGeocode, searchPlaces, type PlaceSuggestion } from "../utils/photon";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

type Loc = { lat: number; lng: number };
export type LocationValue = Loc & { address: string };

function Recenter({ value }: { value: Loc }) {
  const map = useMap();
  useEffect(() => {
    map.setView([value.lat, value.lng], map.getZoom());
  }, [map, value.lat, value.lng]);
  return null;
}

function ClickCapture({ onPick }: { onPick: (loc: Loc) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function LocationPicker({
  value,
  address,
  onChange,
  label = "Address",
  required = true,
}: {
  value: Loc;
  address: string;
  onChange: (next: LocationValue) => void;
  label?: string;
  required?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const lastAppliedRef = useRef("");
  const biasRef = useRef(value);
  biasRef.current = value;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (address.trim() === lastAppliedRef.current) {
      setOpen(false);
      setSuggestions([]);
      setLoading(false);
      setSearchError("");
      return;
    }
    const q = address.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      setSearchError("");
      return;
    }
    const controller = new AbortController();
    setOpen(true);
    setLoading(true);
    setSearchError("");
    const timer = window.setTimeout(async () => {
      try {
        const places = await searchPlaces(q, biasRef.current, controller.signal);
        if (controller.signal.aborted) return;
        setSuggestions(places);
        setActiveIndex(0);
        setOpen(true);
        setLoading(false);
      } catch (err) {
        if (controller.signal.aborted || (err as Error).name === "AbortError") return;
        setSuggestions([]);
        setOpen(true);
        setSearchError("Could not find places right now.");
        setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  function applyPlace(place: PlaceSuggestion) {
    lastAppliedRef.current = place.label;
    setOpen(false);
    setSuggestions([]);
    onChange({ lat: place.lat, lng: place.lng, address: place.label });
  }

  async function applyCoords(loc: Loc) {
    setOpen(false);
    setSuggestions([]);
    let nextAddress = address;
    try {
      const label = await reverseGeocode(loc.lat, loc.lng);
      if (label) nextAddress = label;
    } catch {
      // Keep the typed address if reverse lookup fails.
    }
    lastAppliedRef.current = nextAddress;
    onChange({ ...loc, address: nextAddress });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(suggestions.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && suggestions[activeIndex]) {
      e.preventDefault();
      applyPlace(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && (loading || searchError || address.trim().length >= 3);

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="relative z-50 space-y-1.5">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <input
            className={inputClass}
            value={address}
            onChange={(e) => onChange({ ...value, address: e.target.value })}
            onFocus={() => {
              if (suggestions.length || loading || searchError) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Start typing a place name"
            autoComplete="off"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            required={required}
          />
        </label>
        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-[2000] mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg"
          >
            {loading && <li className="px-3.5 py-2 text-sm text-muted">Searching places...</li>}
            {!loading && searchError && <li className="px-3.5 py-2 text-sm text-muted">{searchError}</li>}
            {!loading && !searchError && suggestions.length === 0 && (
              <li className="px-3.5 py-2 text-sm text-muted">No matching places</li>
            )}
            {!loading &&
              suggestions.map((place, index) => (
                <li key={place.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    className={`w-full px-3.5 py-2 text-left text-sm ${
                      index === activeIndex ? "bg-secondary" : "hover:bg-secondary"
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => applyPlace(place)}
                  >
                    {place.label}
                  </button>
                </li>
              ))}
          </ul>
        )}
      </div>
      <div className="relative z-0 h-56 overflow-hidden rounded-[1.5rem] border border-border">
        <MapContainer center={[value.lat, value.lng]} zoom={14} className="h-full w-full" scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[value.lat, value.lng]} icon={icon} />
          <ClickCapture onPick={applyCoords} />
          <Recenter value={value} />
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          className="rounded-full border border-border px-3 py-1.5 font-medium hover:bg-secondary"
          onClick={() => {
            navigator.geolocation.getCurrentPosition(
              (pos) => applyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => undefined,
            );
          }}
        >
          Use my location
        </button>
        <span className="text-muted">
          {value.lat.toFixed(4)}, {value.lng.toFixed(4)}. Type a place or click the map.
        </span>
      </div>
    </div>
  );
}

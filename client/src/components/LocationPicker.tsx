import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { inputClass } from "./Form";
import { ThemedTileLayer } from "./ThemedTileLayer";
import { reverseGeocode, searchPlaces, type PlaceSuggestion } from "../utils/photon";

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const WAITING_CENTER = { lat: 12.9716, lng: 77.5946 };

type Loc = { lat: number; lng: number };
export type LocationValue = Loc & { address: string };

function shortAreaName(label: string) {
  const parts = label
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 3) return label;
  return parts.slice(0, 3).join(", ");
}

function Recenter({ value, zoom }: { value: Loc; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([value.lat, value.lng], zoom);
  }, [map, value.lat, value.lng, zoom]);
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
  autoLocate = false,
}: {
  value: Loc;
  address: string;
  onChange: (next: LocationValue) => void;
  label?: string;
  required?: boolean;
  autoLocate?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const lastAppliedRef = useRef("");
  const biasRef = useRef(value);
  const addressRef = useRef(address);
  const onChangeRef = useRef(onChange);
  const pickedRef = useRef(!autoLocate);
  biasRef.current = value;
  addressRef.current = address;
  onChangeRef.current = onChange;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasPin, setHasPin] = useState(!autoLocate);
  const [locating, setLocating] = useState(autoLocate);
  const [locateDenied, setLocateDenied] = useState(false);

  async function applyCoords(loc: Loc, ignoreIfPicked = false) {
    if (ignoreIfPicked && pickedRef.current) return;
    pickedRef.current = true;

    setHasPin(true);
    setLocating(false);
    setLocateDenied(false);
    setOpen(false);
    setSuggestions([]);
    let nextAddress = addressRef.current;
    try {
      const label = await reverseGeocode(loc.lat, loc.lng);
      if (label) nextAddress = label;
    } catch {
      // Keep the typed address if reverse lookup fails.
    }
    lastAppliedRef.current = nextAddress;
    onChangeRef.current({ ...loc, address: nextAddress });
  }

  useEffect(() => {
    if (!autoLocate) return;
    if (!navigator.geolocation) {
      setLocating(false);
      setLocateDenied(true);
      return;
    }
    let cancelled = false;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        void applyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true);
      },
      () => {
        if (cancelled) return;
        setLocating(false);
        setLocateDenied(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
    return () => {
      cancelled = true;
    };
  }, [autoLocate]);

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
    pickedRef.current = true;
    lastAppliedRef.current = place.label;
    setHasPin(true);
    setLocating(false);
    setLocateDenied(false);
    setOpen(false);
    setSuggestions([]);
    onChange({ lat: place.lat, lng: place.lng, address: place.label });
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

  const showList = Boolean(open && (loading || searchError || address.trim().length >= 3));
  const namedArea = address.trim() ? shortAreaName(address.trim()) : "";
  const hint = locating
    ? "Asking for your location…"
    : namedArea
      ? namedArea
      : locateDenied
        ? "Location is blocked. Type a place or tap the map."
        : hasPin
          ? "Could not name this spot. Type the road or area."
          : "Allow location, type a place, or tap the map.";
  const mapCenter = hasPin ? value : WAITING_CENTER;
  const mapZoom = hasPin ? 16 : 12;

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="relative z-10 space-y-1.5">
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
            className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg"
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
        <MapContainer attributionControl={false} center={[mapCenter.lat, mapCenter.lng]} zoom={mapZoom} minZoom={11} maxZoom={17} className="h-full w-full" scrollWheelZoom>
          <ThemedTileLayer />
          {hasPin && <Marker position={[value.lat, value.lng]} icon={icon} />}
          <ClickCapture onPick={(loc) => void applyCoords(loc)} />
          <Recenter value={mapCenter} zoom={mapZoom} />
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          className="rounded-full border border-border px-3 py-1.5 font-medium hover:bg-secondary"
          onClick={() => {
            setLocating(true);
            setLocateDenied(false);
            if (!navigator.geolocation) {
              setLocating(false);
              setLocateDenied(true);
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => void applyCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
              () => {
                setLocating(false);
                setLocateDenied(true);
              },
              { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
            );
          }}
        >
          Use my location
        </button>
        <span className="text-muted">{hint}</span>
      </div>
    </div>
  );
}

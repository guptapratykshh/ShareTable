export type PlaceSuggestion = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

type PhotonProperties = {
  osm_id?: number;
  osm_type?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  district?: string;
  city?: string;
  locality?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
};

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: PhotonProperties;
};

type PhotonResponse = { features?: PhotonFeature[] };

const PHOTON = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_URL ?? "");

export function formatPlaceLabel(props: PhotonProperties = {}): string {
  const street = [props.housenumber, props.street].filter(Boolean).join(" ");
  const parts = [props.name, street, props.district, props.city || props.locality, props.county, props.state, props.country];
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const text = part?.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(text);
  }
  return unique.join(", ");
}

function toSuggestion(feature: PhotonFeature, index: number): PlaceSuggestion | null {
  const coords = feature.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const props = feature.properties ?? {};
  const label = formatPlaceLabel(props);
  if (!label) return null;
  const id = `${props.osm_type ?? "n"}-${props.osm_id ?? index}-${lng}-${lat}`;
  return { id, label, lat, lng };
}

async function fetchPhoton(url: string, signal?: AbortSignal): Promise<PhotonResponse> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error("Place search failed.");
  return (await res.json()) as PhotonResponse;
}

function parseFeatures(data: PhotonResponse): PlaceSuggestion[] {
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const [index, feature] of (data.features ?? []).entries()) {
    const item = toSuggestion(feature, index);
    if (!item || seen.has(item.label)) continue;
    seen.add(item.label);
    out.push(item);
  }
  return out;
}

export async function searchPlaces(
  query: string,
  bias?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: "8" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  try {
    const timeout = AbortSignal.timeout(2500);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    return parseFeatures(await fetchPhoton(`${PHOTON}/api/places/search?${params}`, combined));
  } catch (err) {
    if (signal?.aborted) throw err;
    return parseFeatures(await fetchPhoton(`https://photon.komoot.io/api/?${params}`, signal));
  }
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng) });
  let data: PhotonResponse;
  try {
    data = await fetchPhoton(`${PHOTON}/api/places/reverse?${params}`, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    data = await fetchPhoton(`https://photon.komoot.io/reverse?${params}`, signal);
  }
  const first = data.features?.[0];
  return first ? formatPlaceLabel(first.properties) : "";
}

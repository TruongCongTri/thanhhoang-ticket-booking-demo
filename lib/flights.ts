export type Airport = {
  code: string;
  city: string;
  name: string;
  lat: number;
  lon: number;
  /** Outside Vietnam — a destination on the international routes. */
  intl?: boolean;
};

export type Airline = {
  code: string;
  name: string;
  /** Relative fare multiplier used by the mock search. */
  fare: number;
};

export type Flight = {
  id: string;
  airline: Airline;
  number: string;
  from: string;
  to: string;
  depart: number; // minutes after midnight
  arrive: number;
  duration: number; // minutes
  price: number; // VND per passenger
  seatsLeft: number;
};

export const AIRLINES: Airline[] = [
  { code: "VN", name: "Vietnam Airlines", fare: 1.35 },
  { code: "VJ", name: "Vietjet Air", fare: 0.82 },
  { code: "QH", name: "Bamboo Airways", fare: 1.1 },
  { code: "VU", name: "Vietravel Airlines", fare: 0.95 },
  { code: "BL", name: "Pacific Airlines", fare: 0.9 },
  { code: "9G", name: "Sun PhuQuoc Airways", fare: 1.18 },
];

export const AIRPORTS: Airport[] = [
  { code: "HAN", city: "Hà Nội", name: "Nội Bài", lat: 21.221, lon: 105.807 },
  { code: "SGN", city: "TP. Hồ Chí Minh", name: "Tân Sơn Nhất", lat: 10.819, lon: 106.652 },
  { code: "DAD", city: "Đà Nẵng", name: "Đà Nẵng", lat: 16.044, lon: 108.199 },
  { code: "CXR", city: "Nha Trang", name: "Cam Ranh", lat: 11.998, lon: 109.219 },
  { code: "PQC", city: "Phú Quốc", name: "Phú Quốc", lat: 10.227, lon: 103.967 },
  { code: "HPH", city: "Hải Phòng", name: "Cát Bi", lat: 20.819, lon: 106.725 },
  { code: "HUI", city: "Huế", name: "Phú Bài", lat: 16.401, lon: 107.703 },
  { code: "DLI", city: "Đà Lạt", name: "Liên Khương", lat: 11.75, lon: 108.367 },
  { code: "VCA", city: "Cần Thơ", name: "Cần Thơ", lat: 10.085, lon: 105.712 },
  { code: "VII", city: "Vinh", name: "Vinh", lat: 18.737, lon: 105.671 },
  { code: "UIH", city: "Quy Nhơn", name: "Phù Cát", lat: 13.955, lon: 109.042 },
  { code: "BMV", city: "Buôn Ma Thuột", name: "Buôn Ma Thuột", lat: 12.668, lon: 108.12 },
  { code: "VDO", city: "Quảng Ninh", name: "Vân Đồn", lat: 21.118, lon: 107.414 },
  { code: "THD", city: "Thanh Hóa", name: "Thọ Xuân", lat: 19.902, lon: 105.468 },
  { code: "VDH", city: "Đồng Hới", name: "Đồng Hới", lat: 17.515, lon: 106.591 },
  { code: "VCL", city: "Quảng Nam", name: "Chu Lai", lat: 15.403, lon: 108.706 },
  { code: "PXU", city: "Pleiku", name: "Pleiku", lat: 14.004, lon: 108.017 },
  { code: "TBB", city: "Tuy Hòa", name: "Tuy Hòa", lat: 13.05, lon: 109.334 },
  { code: "VCS", city: "Côn Đảo", name: "Côn Đảo", lat: 8.732, lon: 106.633 },
  { code: "VKG", city: "Rạch Giá", name: "Rạch Giá", lat: 9.958, lon: 105.134 },
  { code: "CAH", city: "Cà Mau", name: "Cà Mau", lat: 9.177, lon: 105.178 },
  { code: "DIN", city: "Điện Biên", name: "Điện Biên Phủ", lat: 21.397, lon: 103.008 },
  { code: "NRT", city: "Tokyo", name: "Narita", lat: 35.772, lon: 140.393, intl: true },
  { code: "ICN", city: "Seoul", name: "Incheon", lat: 37.46, lon: 126.44, intl: true },
  { code: "SIN", city: "Singapore", name: "Changi", lat: 1.364, lon: 103.991, intl: true },
  { code: "BKK", city: "Bangkok", name: "Suvarnabhumi", lat: 13.69, lon: 100.75, intl: true },
  { code: "HKG", city: "Hong Kong", name: "Chek Lap Kok", lat: 22.308, lon: 113.918, intl: true },
  { code: "TPE", city: "Taipei", name: "Taoyuan", lat: 25.08, lon: 121.23, intl: true },
  { code: "KUL", city: "Kuala Lumpur", name: "KLIA", lat: 2.745, lon: 101.71, intl: true },
  { code: "CDG", city: "Paris", name: "Charles de Gaulle", lat: 49.01, lon: 2.55, intl: true },
  { code: "SYD", city: "Sydney", name: "Kingsford Smith", lat: -33.94, lon: 151.18, intl: true },
];

/** Airports in Vietnam. */
export const DOMESTIC_AIRPORTS = AIRPORTS.filter((a) => !a.intl);

/** Window event: any element can ask the booking dock to search a route. */
export const ROUTE_EVENT = "thanhhoang:route";
export type RouteEventDetail = { from: string; to: string };

/** Popular domestic routes, shown beside the map of Vietnam. */
export const POPULAR_ROUTES: [string, string][] = [
  ["HAN", "SGN"],
  ["SGN", "DAD"],
  ["HAN", "PQC"],
  ["SGN", "HPH"],
  ["HAN", "CXR"],
];

/** Popular international routes, shown beside the globe. */
export const INTERNATIONAL_POPULAR: [string, string][] = [
  ["HAN", "NRT"],
  ["SGN", "SIN"],
  ["DAD", "ICN"],
  ["SGN", "BKK"],
  ["HAN", "CDG"],
];

export function airport(code: string): Airport {
  return AIRPORTS.find((a) => a.code === code) ?? AIRPORTS[0];
}

/** Lowercase, strip Vietnamese diacritics so "ho chi minh" matches "Hồ Chí Minh". */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function distanceKm(a: Airport, b: Airport): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function flightDuration(from: string, to: string): number {
  const km = distanceKm(airport(from), airport(to));
  return Math.round((32 + (km / 760) * 60) / 5) * 5;
}

/** Cheapest indicative fare, used by the "popular routes" list. */
export function fromPrice(from: string, to: string): number {
  const km = distanceKm(airport(from), airport(to));
  return Math.round(((390000 + km * 1250) * 0.82 * 0.8) / 10000) * 10000;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mock of the aggregated airline search. In production each airline block
 * would be one API call to that carrier; here it is deterministic per
 * route + date so results feel stable.
 */
export function searchFlights(from: string, to: string, date: string): Flight[] {
  const a = airport(from);
  const b = airport(to);
  const km = distanceKm(a, b);
  const rand = seeded(hash(`${from}-${to}-${date}`));
  const duration = flightDuration(from, to);
  const base = 390000 + km * 1250;
  const touchesPQC = from === "PQC" || to === "PQC";

  const flights: Flight[] = [];
  for (const al of AIRLINES) {
    const major = al.code === "VN" || al.code === "VJ";
    let n = Math.floor(rand() * 3) + (major ? 1 : 0);
    if (al.code === "9G") n = touchesPQC ? 2 : rand() < 0.3 ? 1 : 0;
    if (km < 350 && !major) n = Math.max(0, n - 1);
    for (let i = 0; i < n; i++) {
      const depart = 330 + Math.floor(rand() * 204) * 5;
      flights.push({
        id: `${al.code}-${i}-${depart}`,
        airline: al,
        number: `${al.code} ${100 + Math.floor(rand() * 900)}`,
        from,
        to,
        depart,
        arrive: depart + duration,
        duration,
        price: Math.round((base * al.fare * (0.8 + rand() * 0.45)) / 1000) * 1000,
        seatsLeft: 1 + Math.floor(rand() * 9),
      });
    }
  }
  return flights.sort((x, y) => x.price - y.price);
}

export function formatVND(n: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(n)}₫`;
}

export function formatClock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

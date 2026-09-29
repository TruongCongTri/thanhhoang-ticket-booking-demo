/**
 * Geography drawn by the particle scene: the two archipelagos, the domestic
 * route network and international routes out of Vietnam. Coordinates are
 * approximate (±0.05°) — enough for a map at this scale.
 */

/** L ≥ 1 km² · M 0.2–1 km² · S 0.02–0.2 km² · R reef, rock or sand cay. */
export type IslandSize = "L" | "M" | "S" | "R";
/** name, lat, lon, size */
export type Island = [string, number, number, IslandSize];

export const HOANG_SA: Island[] = [
  ["Phú Lâm", 16.834, 112.339, "L"],
  ["Linh Côn", 16.668, 112.727, "L"],
  ["Tri Tôn", 15.784, 111.203, "M"],
  ["Hoàng Sa", 16.535, 111.608, "M"],
  ["Quang Hòa", 16.449, 111.713, "M"],
  ["Duy Mộng", 16.466, 111.742, "M"],
  ["Hữu Nhật", 16.524, 111.577, "M"],
  ["Quang Ảnh", 16.45, 111.508, "M"],
  ["Cây", 16.98, 112.263, "S"],
  ["Bắc", 16.968, 112.315, "S"],
  ["Trung", 16.962, 112.323, "S"],
  ["Nam", 16.953, 112.334, "S"],
  ["Bạch Quy", 16.054, 111.766, "S"],
  ["Đá", 16.846, 112.346, "R"],
  ["Cồn Cát Tây", 16.98, 112.2, "R"],
  ["Đá Bắc", 17.081, 111.504, "R"],
  ["Đá Lồi", 16.233, 111.667, "R"],
  ["Đá Hải Sâm", 16.463, 111.585, "R"],
  ["Đá Chim Yến", 16.333, 112.029, "R"],
  ["Bãi Châu Nhai", 16.283, 112.517, "R"],
  ["Đá Bông Bay", 16.033, 112.533, "R"],
  ["Đá Tháp", 16.575, 111.708, "R"],
];

export const TRUONG_SA: Island[] = [
  ["Ba Bình", 10.377, 114.365, "M"],
  ["Thị Tứ", 11.055, 114.284, "M"],
  ["Trường Sa Lớn", 8.644, 111.918, "M"],
  ["Song Tử Tây", 11.43, 114.331, "S"],
  ["Song Tử Đông", 11.453, 114.356, "S"],
  ["Bến Lạc", 11.083, 115.022, "S"],
  ["Nam Yết", 10.182, 114.364, "S"],
  ["Loại Ta", 10.673, 114.425, "S"],
  ["Sinh Tồn", 9.883, 114.329, "S"],
  ["Sơn Ca", 10.376, 114.479, "S"],
  ["An Bang", 7.867, 112.917, "R"],
  ["Phan Vinh", 8.957, 113.692, "R"],
  ["Sinh Tồn Đông", 9.917, 114.567, "R"],
  ["Trường Sa Đông", 8.93, 112.35, "R"],
  ["Đá Tây", 8.855, 112.233, "R"],
  ["Đá Lát", 8.667, 111.667, "R"],
  ["Đá Đông", 8.83, 112.583, "R"],
  ["Thuyền Chài", 8.1, 113.3, "R"],
  ["Tốc Tan", 8.8, 113.967, "R"],
  ["Núi Le", 8.7, 114.183, "R"],
  ["Tiên Nữ", 8.85, 114.65, "R"],
  ["Chữ Thập", 9.55, 112.89, "R"],
  ["Châu Viên", 8.86, 112.833, "R"],
  ["Gạc Ma", 9.717, 114.283, "R"],
  ["Cô Lin", 9.76, 114.255, "R"],
  ["Len Đao", 9.783, 114.367, "R"],
  ["Vành Khăn", 9.9, 115.533, "R"],
  ["Ba Đầu", 9.983, 114.65, "R"],
  ["Kỳ Vân", 7.983, 113.9, "R"],
  ["Hoa Lau", 7.373, 113.833, "R"],
  ["Su Bi", 10.917, 114.083, "R"],
  ["Ga Ven", 10.21, 114.225, "R"],
  ["Tư Nghĩa", 9.917, 114.483, "R"],
  ["Núi Thị", 10.412, 114.583, "R"],
  ["Đá Nam", 11.383, 114.3, "R"],
  ["Đá Lớn", 10.05, 113.85, "R"],
  ["Sác Lốt", 7.0, 113.583, "R"],
  ["Kiệu Ngựa", 8.383, 115.233, "R"],
  ["Thám Hiểm", 8.133, 114.667, "R"],
  ["Công Đo", 8.1, 114.133, "R"],
];

/** Where the archipelago names sit on the map (lon, lat). */
export const ARCHIPELAGO_LABELS = [
  { text: "QĐ. Hoàng Sa", lon: 112.0, lat: 17.65 },
  { text: "QĐ. Trường Sa", lon: 113.5, lat: 12.05 },
] as const;

/** Domestic routes (airport codes from lib/flights), one line each. */
export const DOMESTIC_ROUTES: [string, string][] = [
  ["HAN", "SGN"], ["HAN", "DAD"], ["HAN", "CXR"], ["HAN", "PQC"], ["HAN", "DLI"],
  ["HAN", "HUI"], ["HAN", "UIH"], ["HAN", "VCA"], ["HAN", "BMV"], ["HAN", "PXU"],
  ["HAN", "TBB"], ["HAN", "VCL"], ["HAN", "DIN"], ["HAN", "VCS"],
  ["SGN", "DAD"], ["SGN", "HPH"], ["SGN", "VII"], ["SGN", "THD"], ["SGN", "VDH"],
  ["SGN", "HUI"], ["SGN", "VDO"], ["SGN", "UIH"], ["SGN", "TBB"], ["SGN", "PXU"],
  ["SGN", "BMV"], ["SGN", "DLI"], ["SGN", "CXR"], ["SGN", "PQC"], ["SGN", "VCS"],
  ["SGN", "VCL"], ["SGN", "VKG"], ["SGN", "CAH"],
  ["DAD", "HPH"], ["DAD", "CXR"], ["DAD", "DLI"], ["DAD", "PQC"], ["DAD", "VCA"],
  ["HPH", "CXR"], ["HPH", "PQC"], ["HPH", "DLI"],
  ["VII", "DLI"], ["VII", "CXR"], ["VII", "BMV"],
  ["THD", "DLI"], ["THD", "CXR"],
];

/** Vietnam's international gateways shown on the globe (lat, lon). */
export const GATEWAYS: Record<string, [number, number]> = {
  HAN: [21.221, 105.807],
  SGN: [10.819, 106.652],
  DAD: [16.044, 108.199],
  CXR: [11.998, 109.219],
  PQC: [10.227, 103.967],
  HPH: [20.819, 106.725],
};

/** International routes: gateway, destination, lat, lon. */
export const INTERNATIONAL_ROUTES: [string, string, number, number][] = [
  ["HAN", "Tokyo", 35.55, 139.78],
  ["HAN", "Osaka", 34.43, 135.24],
  ["HAN", "Seoul", 37.46, 126.44],
  ["HAN", "Beijing", 40.08, 116.58],
  ["HAN", "Shanghai", 31.14, 121.81],
  ["HAN", "Hong Kong", 22.31, 113.91],
  ["HAN", "Bangkok", 13.69, 100.75],
  ["HAN", "Singapore", 1.36, 103.99],
  ["HAN", "Delhi", 28.56, 77.1],
  ["HAN", "Paris", 49.01, 2.55],
  ["HAN", "Frankfurt", 50.03, 8.57],
  ["HAN", "London", 51.47, -0.45],
  ["HAN", "Sydney", -33.94, 151.18],
  ["SGN", "Tokyo", 35.55, 139.78],
  ["SGN", "Seoul", 37.46, 126.44],
  ["SGN", "Taipei", 25.08, 121.23],
  ["SGN", "Hong Kong", 22.31, 113.91],
  ["SGN", "Manila", 14.51, 121.02],
  ["SGN", "Jakarta", -6.13, 106.66],
  ["SGN", "Kuala Lumpur", 2.74, 101.71],
  ["SGN", "Singapore", 1.36, 103.99],
  ["SGN", "Bangkok", 13.69, 100.75],
  ["SGN", "Mumbai", 19.09, 72.87],
  ["SGN", "Dubai", 25.25, 55.36],
  ["SGN", "Paris", 49.01, 2.55],
  ["SGN", "Frankfurt", 50.03, 8.57],
  ["SGN", "San Francisco", 37.62, -122.38],
  ["SGN", "Melbourne", -37.67, 144.84],
  ["SGN", "Perth", -31.94, 115.97],
  ["DAD", "Seoul", 37.46, 126.44],
  ["DAD", "Busan", 35.18, 128.94],
  ["DAD", "Tokyo", 35.55, 139.78],
  ["DAD", "Singapore", 1.36, 103.99],
  ["CXR", "Seoul", 37.46, 126.44],
  ["CXR", "Almaty", 43.35, 77.04],
  ["PQC", "Seoul", 37.46, 126.44],
  ["PQC", "Singapore", 1.36, 103.99],
  ["HPH", "Seoul", 37.46, 126.44],
];

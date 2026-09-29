import QRCode from "qrcode";
import { airport, formatDuration } from "@/lib/flights";
import type { BookedLeg } from "@/lib/trips";

/**
 * A boarding pass, drawn as one SVG — shown on the page and downloaded as a
 * PNG, so what you save is exactly what you saw. The QR code is real: it
 * encodes the booking, flight, passenger and seat.
 */

export type TicketLabels = {
  boardingPass: string;
  passenger: string;
  flight: string;
  date: string;
  boarding: string;
  gateCloses: string;
  gate: string;
  seat: string;
  terminal: string;
  bookingCode: string;
};

export type TicketInput = {
  brand: string;
  code: string;
  passenger: string;
  seat: string;
  gate: string;
  terminal: string;
  leg: BookedLeg;
  dateText: string;
  boardingText: string;
  gateCloseText: string;
  labels: TicketLabels;
};

export const TICKET_W = 1000;
export const TICKET_H = 380;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** What the QR code says. */
export const qrText = (i: Pick<TicketInput, "code" | "passenger" | "seat" | "leg">) =>
  `THANHHOANG|${i.code}|${i.leg.number.replace(/\s/g, "")}|${i.leg.date}|${i.leg.from}-${i.leg.to}|${i.passenger.toUpperCase()}|${i.seat}`;

export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
}

export function ticketSvg(i: TicketInput, qr: string): string {
  const L = i.labels;
  const A = airport(i.leg.from);
  const B = airport(i.leg.to);
  const font = "Inter, 'Segoe UI', Roboto, Arial, sans-serif";
  const label = (x: number, y: number, text: string) =>
    `<text x="${x}" y="${y}" fill="#8a8f98" font-size="12" font-weight="600" letter-spacing="2">${esc(text.toUpperCase())}</text>`;
  const value = (x: number, y: number, text: string, color = "#ffffff", size = 22) =>
    `<text x="${x}" y="${y}" fill="${color}" font-size="${size}">${esc(text)}</text>`;
  const qrSized = qr.replace("<svg ", '<svg x="786" y="72" width="168" height="168" ');
  const name = i.passenger.length > 24 ? `${i.passenger.slice(0, 23)}…` : i.passenger;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${TICKET_W}" height="${TICKET_H}" viewBox="0 0 ${TICKET_W} ${TICKET_H}" font-family="${font}">
  <defs>
    <mask id="notch"><rect width="${TICKET_W}" height="${TICKET_H}" rx="28" fill="#fff"/><circle cx="740" cy="0" r="18" fill="#000"/><circle cx="740" cy="${TICKET_H}" r="18" fill="#000"/></mask>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a6cc2" stop-opacity=".28"/><stop offset=".55" stop-color="#0c0e14" stop-opacity="0"/></linearGradient>
  </defs>
  <g mask="url(#notch)">
    <rect width="${TICKET_W}" height="${TICKET_H}" fill="#0c0e14"/>
    <rect width="${TICKET_W}" height="${TICKET_H}" fill="url(#glow)"/>
    <rect x="740" y="0" width="${TICKET_W - 740}" height="${TICKET_H}" fill="#11141c"/>
  </g>
  <line x1="740" y1="26" x2="740" y2="${TICKET_H - 26}" stroke="#3a3f4a" stroke-width="2" stroke-dasharray="6 8"/>

  <text x="40" y="58" fill="#3d9bf0" font-size="20" font-weight="700" letter-spacing="3">${esc(i.brand.toUpperCase())}</text>
  <text x="700" y="58" text-anchor="end" fill="#8a8f98" font-size="13" font-weight="600" letter-spacing="3">${esc(L.boardingPass.toUpperCase())}</text>

  <text x="40" y="150" fill="#ffffff" font-size="72" font-weight="600" letter-spacing="-1">${i.leg.from}</text>
  ${value(42, 180, A.city, "#bdbdbd", 15)}
  <text x="700" y="150" text-anchor="end" fill="#ffffff" font-size="72" font-weight="600" letter-spacing="-1">${i.leg.to}</text>
  <text x="700" y="180" text-anchor="end" fill="#bdbdbd" font-size="15">${esc(B.city)}</text>
  <line x1="250" y1="124" x2="470" y2="124" stroke="#3d9bf0" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round"/>
  <path d="M486 124 l-16 -9 v18 z" fill="#3d9bf0"/>
  <text x="368" y="110" text-anchor="middle" fill="#8a8f98" font-size="13">${esc(formatDuration(i.leg.duration))}</text>

  ${label(40, 236, L.passenger)}${value(40, 264, name)}
  ${label(360, 236, L.flight)}${value(360, 264, i.leg.number)}
  ${label(510, 236, L.date)}${value(510, 264, i.dateText)}

  ${label(40, 312, L.boarding)}${value(40, 340, i.boardingText, "#3d9bf0")}
  ${label(190, 312, L.gateCloses)}${value(190, 340, i.gateCloseText, "#f5a830")}
  ${label(360, 312, L.gate)}${value(360, 340, i.gate)}
  ${label(450, 312, L.terminal)}${value(450, 340, i.terminal)}
  ${label(560, 312, L.seat)}${value(560, 340, i.seat, "#ffffff", 26)}

  <rect x="776" y="62" width="188" height="188" rx="16" fill="#ffffff"/>
  ${qrSized}
  ${label(776, 290, L.seat)}${value(776, 322, i.seat, "#ffffff", 28)}
  ${label(866, 290, L.bookingCode)}
  <text x="866" y="322" fill="#3d9bf0" font-size="24" font-weight="700" letter-spacing="2">${esc(i.code)}</text>
</svg>`;
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function save(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Renders the SVG at 2× and saves it as a PNG. */
export async function downloadPng(svg: string, width: number, height: number, filename: string) {
  const img = new Image();
  img.decoding = "async";
  img.src = svgDataUrl(svg);
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("no image");
  const url = URL.createObjectURL(blob);
  save(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** The QR code alone, large, with a quiet zone. */
export async function downloadQr(text: string, filename: string) {
  save(await QRCode.toDataURL(text, { width: 900, margin: 3, errorCorrectionLevel: "M" }), filename);
}

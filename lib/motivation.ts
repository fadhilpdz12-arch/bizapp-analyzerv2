export interface Quote {
  text: string;
  tag: string;
}

export const QUOTES: Quote[] = [
  { text: "Yang diukur, boleh diperbaiki. Yang diabaikan, jadi kos.", tag: "Prinsip Operasi" },
  { text: "Data yang dibaca hari ni, keputusan yang menang esok.", tag: "Fokus" },
  { text: "Setiap return ada sebab. Setiap sebab ada penyelesaian.", tag: "Akar Masalah" },
  { text: "Sikit-sikit, lama-lama jadi bukit — setiap parcel yang diselamatkan tu untung.", tag: "Peribahasa" },
  { text: "Bos tanya kenapa. Hari ni, kau dah ada jawapan.", tag: "Bersedia" },
  { text: "Angka tak menipu. Yang penting berani tengok.", tag: "Kejujuran Data" },
  { text: "Jangan biar parcel pending jadi return. Masa tu emas.", tag: "Bertindak Awal" },
  { text: "Kerja kau bukan setakat isi data — kau jaga duit syarikat.", tag: "Peranan" },
  { text: "Bukan kerja keras je yang menang. Kerja pintar dengan data.", tag: "Strategi" },
  { text: "Hari ni kau tahu sesuatu yang semalam kau tak tahu. Tu dah satu kemenangan.", tag: "Kemajuan" },
  { text: "Keputusan yang baik datang dari maklumat yang jelas.", tag: "Kejelasan" },
  { text: "Biar lambat asalkan tepat — tapi kalau boleh cepat dan tepat, lagi bagus.", tag: "Ketepatan" },
];

export function quoteOfTheMoment(seed?: number): Quote {
  const n = seed ?? Math.floor(Date.now() / 60000); // rotates each minute
  return QUOTES[n % QUOTES.length];
}

export function greeting(d: Date = new Date()): { hello: string; nudge: string } {
  const h = d.getHours();
  if (h < 12) return { hello: "Selamat pagi", nudge: "Jom mula hari ni dengan data yang jelas." };
  if (h < 15) return { hello: "Selamat tengah hari", nudge: "Rehat kejap, lepas tu kita tengok angka." };
  if (h < 19) return { hello: "Selamat petang", nudge: "Masa terbaik untuk semak parcel tergendala." };
  return { hello: "Selamat malam", nudge: "Kerja lebih masa? Biar dashboard tolong ringankan." };
}

export const LOADING_STEPS: string[] = [
  "Membuka fail…",
  "Mengesan struktur kolum…",
  "Membaca setiap baris order…",
  "Mengklasifikasi status parcel…",
  "Mengira sebab return…",
  "Menyiapkan dashboard…",
];

export function funFact(orders: number, ms: number): string {
  const perSec = ms > 0 ? Math.round(orders / (ms / 1000)) : orders;
  return `${orders.toLocaleString()} order diproses dalam ${(ms / 1000).toFixed(1)} saat — lebih kurang ${perSec.toLocaleString()} baris sesaat.`;
}

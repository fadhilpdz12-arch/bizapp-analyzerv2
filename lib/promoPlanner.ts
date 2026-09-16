/**
 * Promotion planner storage.
 *
 * Plans live in localStorage alongside the reprocess tracking. Images are the
 * only real constraint: localStorage caps out around 5 MB, so pictures are
 * downscaled and re-encoded before being stored rather than kept at full size.
 */

export type PlanStatus = "Draf" | "Aktif" | "Selesai" | "Arkib";

export const PLAN_STATUSES: PlanStatus[] = ["Draf", "Aktif", "Selesai", "Arkib"];

export interface PlanLink {
  label: string;
  url: string;
}

export interface PromoPlan {
  id: string;
  title: string;
  status: PlanStatus;
  /** Overall creative direction, e.g. "Raya — nostalgia kampung". */
  theme: string;
  /** What's in the bundle being offered back to the customer. */
  productPackage: string;
  /** The words the agent actually says or sends. */
  offerScript: string;
  notes: string;
  startDate: string; // yyyy-mm-dd
  endDate: string;
  /** Compressed data URLs for posters and mock-ups. */
  posters: string[];
  links: PlanLink[];
  createdAt: string;
  updatedAt: string;
}

const STORE_KEY = "bizapp-promo-plans-v1";

function nowISO() {
  return new Date().toISOString();
}

export function newPlan(): PromoPlan {
  const ts = nowISO();
  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: "",
    status: "Draf",
    theme: "",
    productPackage: "",
    offerScript: "",
    notes: "",
    startDate: "",
    endDate: "",
    posters: [],
    links: [],
    createdAt: ts,
    updatedAt: ts,
  };
}

// ── Persistence ────────────────────────────────────────────────────────────

export function loadPlans(): PromoPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export interface SaveResult {
  ok: boolean;
  message?: string;
}

export function savePlans(plans: PromoPlan[]): SaveResult {
  if (typeof window === "undefined") return { ok: false };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(plans));
    return { ok: true };
  } catch (err) {
    // Almost always the 5 MB quota, and almost always caused by posters.
    const quota =
      err instanceof DOMException &&
      (err.name === "QuotaExceededError" || err.code === 22);
    return {
      ok: false,
      message: quota
        ? "Storan penuh. Padam beberapa poster atau arkibkan rancangan lama."
        : "Gagal menyimpan rancangan.",
    };
  }
}

// ── Images ─────────────────────────────────────────────────────────────────

const MAX_EDGE = 900;
const QUALITY = 0.72;

/**
 * Downscales and re-encodes an image so a handful of posters can live in
 * localStorage without hitting the quota.
 */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Fail ini bukan gambar."));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca gambar."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Gambar rosak atau format tidak disokong."));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Browser tidak menyokong pemprosesan gambar."));
          return;
        }
        // Flatten onto white so transparent PNGs don't turn black as JPEG.
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Rough size of everything stored, for the usage meter. */
export function storageUsedKB(plans: PromoPlan[]): number {
  try {
    return Math.round(JSON.stringify(plans).length / 1024);
  } catch {
    return 0;
  }
}

// ── Sharing ────────────────────────────────────────────────────────────────

export interface PlanFile {
  app: "bizapp-analyzer";
  kind: "promo-plans";
  version: 1;
  exportedAt: string;
  plans: PromoPlan[];
}

export function exportPlans(plans: PromoPlan[]): string {
  const payload: PlanFile = {
    app: "bizapp-analyzer",
    kind: "promo-plans",
    version: 1,
    exportedAt: nowISO(),
    plans,
  };
  return JSON.stringify(payload, null, 2);
}

export interface PlanImportResult {
  ok: boolean;
  message: string;
  merged?: PromoPlan[];
}

export function importPlans(json: string, current: PromoPlan[]): PlanImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: "Fail ini bukan fail rancangan yang sah." };
  }
  const file = parsed as Partial<PlanFile>;
  if (file?.kind !== "promo-plans" || !Array.isArray(file.plans)) {
    return { ok: false, message: "Fail ini bukan fail rancangan promosi." };
  }

  const byId = new Map(current.map((p) => [p.id, p]));
  let added = 0;
  let updated = 0;

  for (const incoming of file.plans) {
    const existing = byId.get(incoming.id);
    if (!existing) {
      byId.set(incoming.id, incoming);
      added += 1;
    } else if ((incoming.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      byId.set(incoming.id, incoming);
      updated += 1;
    }
  }

  return {
    ok: true,
    message: `${added} rancangan baharu, ${updated} dikemas kini.`,
    merged: Array.from(byId.values()),
  };
}

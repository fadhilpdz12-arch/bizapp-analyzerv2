"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { RiskParcel } from "@/lib/types";

import {
  RiskRecord,
  RiskStatus,
  RISK_STATUSES,
  blankRisk,
  loadRisk,
  saveRisk,
  riskKey,
  summariseRisk,
} from "@/lib/riskFollowup";

import {
  CauseRecord,
  causeKey,
  loadCauseMap,
  loadCauses,
  saveCauseMap,
} from "@/lib/returnCause";

import { waLink } from "@/lib/winback";
import { sfxSuccess, sfxSave } from "@/lib/sfx";
import { recordActivity } from "@/lib/engagement";

import CountUp from "./CountUp";


const STATUS_STYLE: Record<RiskStatus, string> = {
  "Belum Hubungi":
    "text-content-300 border-surface-500 bg-surface-700",

  "Confirmation Reply":
    "text-stamp-green border-stamp-green/40 bg-stamp-green/10",

  "Confirmation Tidak Reply":
    "text-stamp-amber border-stamp-amber/40 bg-stamp-amber/10",

  "Dah Hubungi — Akan Terima":
    "text-stamp-amber border-stamp-amber/40 bg-stamp-amber/10",

  "Minta Hantar Semula":
    "text-stamp-amber border-stamp-amber/40 bg-stamp-amber/10",

  "Cancel Order":
    "text-stamp-red border-stamp-red/40 bg-stamp-red/10",

  "Tak Dapat Dihubungi":
    "text-stamp-red border-stamp-red/40 bg-stamp-red/10",

  "Selamat — Sampai":
    "text-stamp-green border-stamp-green/40 bg-stamp-green/10",
};


/*
 * Status yang label dia sama persis dengan salah satu Punca Return —
 * bila admin tanda status ni, terus auto-isi Punca Return juga supaya
 * tak perlu pilih 2 kali untuk benda yang sama. Kalau admin dah tanda
 * punca lain secara manual, auto-fill ni tak akan override.
 */
const AUTO_CAUSE_STATUSES = new Set<RiskStatus>([
  "Confirmation Reply",
  "Confirmation Tidak Reply",
  "Cancel Order",
]);

function rm(n: number) {
  return `RM ${Math.round(n).toLocaleString()}`;
}


function message(p: RiskParcel): string {
  return (
    `Salam ${p.customerName || "puan/tuan"}, saya dari Meldoria. ` +
    `Parcel ${p.product || "pesanan anda"} (${p.trackingNo}) nampak tersangkut ` +
    `${p.daysStalled} hari di pihak kurier. ` +
    `Boleh saya bantu semak, atau nak saya minta rider hantar semula?`
  );
}


export default function RiskParcelPanel({
  parcels,
  thresholdDays,
}: {
  parcels: RiskParcel[];
  thresholdDays: number;
}) {
  /*
   * Status follow-up Selamatkan
   */
  const [map, setMap] =
    useState<Record<string, RiskRecord>>({});

  /*
   * Punca Return
   * Guna storage yang sama dengan CausePanel.
   */
  const [causeMap, setCauseMap] =
    useState<Record<string, CauseRecord>>({});

  const [causes, setCauses] =
    useState<string[]>([]);

  const [ready, setReady] = useState(false);

  const [showAll, setShowAll] = useState(false);

  const [open, setOpen] =
    useState<string | null>(null);

  const [filter, setFilter] =
    useState<RiskStatus | "semua">("semua");


  /*
   * Load semua data daripada browser.
   */
  useEffect(() => {
    setMap(loadRisk());

    setCauseMap(loadCauseMap());

    setCauses(loadCauses());

    setReady(true);
  }, []);


  /*
   * Ringkasan Selamatkan.
   */
  const summary = useMemo(
    () => summariseRisk(parcels, map),
    [parcels, map]
  );


  /*
   * Filter parcel berdasarkan status follow-up.
   */
  const visible = useMemo(() => {
    const list =
      filter === "semua"
        ? parcels
        : parcels.filter(
            (p) =>
              (
                map[riskKey(p.trackingNo)]?.status ??
                "Belum Hubungi"
              ) === filter
          );

    /*
     * Parcel belum disentuh diletakkan paling atas.
     */
    return [...list].sort((a, b) => {
      const statusA =
        map[riskKey(a.trackingNo)]?.status ??
        "Belum Hubungi";

      const statusB =
        map[riskKey(b.trackingNo)]?.status ??
        "Belum Hubungi";

      const rank = (status: string) => {
        if (status === "Belum Hubungi") return 0;

        if (status === "Selamat — Sampai") return 2;

        return 1;
      };

      return (
        rank(statusA) -
          rank(statusB) ||
        b.amount - a.amount
      );
    });
  }, [parcels, map, filter]);


  const shown =
    showAll
      ? visible
      : visible.slice(0, 12);


  /*
   * Update status Selamatkan.
   */
  const update = useCallback(
    (
      parcel: RiskParcel,
      patch: Partial<RiskRecord>
    ) => {
      const key =
        riskKey(parcel.trackingNo);

      setMap((prev) => {
        const base =
          prev[key] ?? blankRisk();

        const next = {
          ...prev,

          [key]: {
            ...base,
            ...patch,
            updatedAt:
              new Date().toISOString(),
          },
        };

        if (!saveRisk(next)) {
          return prev;
        }

        if (
          patch.status ===
            "Selamat — Sampai" &&
          base.status !==
            "Selamat — Sampai"
        ) {
          sfxSuccess();
        } else if (patch.status) {
          sfxSave();
        }

        if (patch.status) {
          recordActivity(0);
        }

        // Auto-isi Punca Return bila status yang label sama ditanda.
        if (
          patch.status &&
          AUTO_CAUSE_STATUSES.has(patch.status)
        ) {
          const cKey = causeKey(parcel.trackingNo);
          setCauseMap((prevCause) => {
            if (prevCause[cKey]) return prevCause; // dah ada tag manual — jangan override
            const nextCause = {
              ...prevCause,
              [cKey]: {
                cause: patch.status as string,
                updatedAt: new Date().toISOString(),
              },
            };
            saveCauseMap(nextCause);
            return nextCause;
          });
        }

        return next;
      });
    },
    []
  );


  /*
   * Update Punca Return.
   *
   * Data ini masuk ke storage yang sama
   * dengan tab Punca Return.
   */
  const updateCause = useCallback(
    (
      trackingNo: string,
      cause: string
    ) => {
      const key =
        causeKey(trackingNo);

      setCauseMap((prev) => {
        const next = {
          ...prev,
        };

        /*
         * Kalau dropdown dikosongkan,
         * buang tag.
         */
        if (!cause) {
          delete next[key];
        } else {
          next[key] = {
            cause,
            updatedAt:
              new Date().toISOString(),
          };
        }

        /*
         * Simpan ke localStorage
         * yang sama seperti CausePanel.
         */
        if (!saveCauseMap(next)) {
          return prev;
        }

        if (cause) {
          sfxSave();
        }

        return next;
      });
    },
    []
  );


  /*
   * Loading.
   */
  if (!ready) {
    return (
      <div className="ticket p-6">
        <p className="text-content-300 text-[13px]">
          Memuatkan…
        </p>
      </div>
    );
  }


  /*
   * Tiada parcel berisiko.
   */
  if (parcels.length === 0) {
    return (
      <div className="ticket p-5 sm:p-6 fade-up">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
          Parcel Berisiko — Perlu Tindakan
        </p>

        <p className="text-stamp-green text-[13.5px] mt-3">
          Tiada parcel tersangkut.
          Semua pending masih dalam
          tempoh normal.
        </p>
      </div>
    );
  }


  return (
    <div className="ticket p-5 sm:p-6 fade-up">

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 flex-wrap">

        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
            Parcel Berisiko — Perlu Tindakan
          </p>

          <p className="text-[12.5px] text-content-300/70 mt-1.5 max-w-md leading-relaxed">
            Parcel PENDING yang tiada
            pergerakan melebihi{" "}
            {thresholdDays} hari.
            Hubungi customer sebelum ia
            auto-return.
          </p>
        </div>


        <div className="text-right">

          <p className="font-display font-extrabold text-3xl text-stamp-amber leading-none">
            <CountUp
              value={summary.pending}
            />
          </p>

          <p className="font-mono text-[10.5px] text-content-300/60 mt-1">
            belum dihubungi ·{" "}
            {rm(summary.pendingValue)}
          </p>

        </div>

      </div>


      {/* SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mt-4 pt-4 border-t border-surface-600">

        <Stat
          label="Jumlah"
          value={summary.total}
        />

        <Stat
          label="Dah Dihubungi"
          value={summary.contacted}
          tone="amber"
        />

        <Stat
          label="Selamat Sampai"
          value={summary.saved}
          tone="green"
          sub={rm(summary.savedValue)}
        />

        <Stat
          label="Dibatalkan"
          value={summary.cancelled}
          tone="red"
          sub={rm(summary.cancelledValue)}
        />

        <Stat
          label="Tak Dapat Dihubungi"
          value={summary.unreachable}
          tone="red"
        />

      </div>


      {/* STATUS FILTER */}
      <div className="flex flex-wrap gap-2 mt-4">

        {(
          [
            "semua",
            ...RISK_STATUSES,
          ] as const
        ).map((status) => {

          const count =
            status === "semua"
              ? parcels.length
              : parcels.filter(
                  (p) =>
                    (
                      map[
                        riskKey(
                          p.trackingNo
                        )
                      ]?.status ??
                      "Belum Hubungi"
                    ) === status
                ).length;


          if (
            status !== "semua" &&
            count === 0
          ) {
            return null;
          }


          return (
            <button
              key={status}
              onClick={() =>
                setFilter(status)
              }
              className={`
                font-mono
                text-[10.5px]
                uppercase
                tracking-wider
                px-2.5
                py-1.5
                rounded-lg
                border
                transition-colors

                ${
                  filter === status
                    ? "border-accent text-accent-ink bg-accent-wash"
                    : "border-surface-600 text-content-300 hover:bg-surface-700"
                }
              `}
            >
              {status === "semua"
                ? "Semua"
                : status}{" "}
              ({count})
            </button>
          );
        })}

      </div>


      {/* LIST CUSTOMER */}
      <div className="space-y-2 mt-4">

        {shown.map((parcel) => {

          const key =
            riskKey(parcel.trackingNo);

          const rec =
            map[key] ?? blankRisk();

          const isOpen =
            open === key;

          const link =
            waLink(
              parcel.phone,
              message(parcel)
            );

          /*
           * Ambil Punca Return
           * berdasarkan tracking sama.
           */
          const causeRec =
            causeMap[
              causeKey(
                parcel.trackingNo
              )
            ];


          return (
            <div
              key={key}
              className="
                border
                border-surface-600
                rounded-xl
                overflow-hidden
              "
            >

              {/* MAIN CUSTOMER ROW */}
              <div
                className="
                  px-3.5
                  py-3
                  grid
                  grid-cols-1
                  lg:grid-cols-[minmax(0,1fr)_240px_auto]
                  gap-3
                  lg:items-center
                "
              >

                {/* CUSTOMER */}
                <div className="flex items-start gap-2.5 min-w-0">

                  <span
                    className={`
                      font-mono
                      text-[9px]
                      uppercase
                      tracking-wider
                      border
                      rounded-full
                      px-1.5
                      py-1
                      whitespace-nowrap
                      shrink-0

                      ${
                        parcel.severity ===
                        "kritikal"
                          ? "text-stamp-red border-stamp-red/40 bg-stamp-red/10"
                          : "text-stamp-amber border-stamp-amber/40 bg-stamp-amber/10"
                      }
                    `}
                  >
                    {parcel.daysStalled}h
                  </span>


                  <div className="min-w-0 flex-1">

                    <div className="flex flex-wrap items-center gap-2">

                      <span className="text-[13.5px] font-medium text-content-100">
                        {parcel.customerName}
                      </span>


                      <span
                        className={`
                          font-mono
                          text-[9px]
                          uppercase
                          tracking-wider
                          border
                          rounded-full
                          px-1.5
                          py-0.5
                          ${STATUS_STYLE[
                            rec.status
                          ]}
                        `}
                      >
                        {rec.status}
                      </span>

                    </div>


                    <p className="text-[12px] text-content-300/80 mt-0.5">
                      {parcel.product}
                      {" · "}
                      {parcel.courierProvider}
                    </p>


                    <p className="font-mono text-[10.5px] text-content-300/60 mt-1">
                      {parcel.trackingNo}
                    </p>

                  </div>

                </div>


                {/* PUNCA RETURN */}
                <div className="w-full">

                  <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/50 mb-1">
                    Punca Return
                  </p>


                  <select
                    value={
                      causeRec?.cause ?? ""
                    }
                    onChange={(e) =>
                      updateCause(
                        parcel.trackingNo,
                        e.target.value
                      )
                    }
                    className={`
                      input
                      w-full

                      ${
                        causeRec
                          ? "border-accent/50"
                          : ""
                      }
                    `}
                  >

                    <option value="">
                      — Pilih punca return —
                    </option>


                    {causes.map(
                      (cause) => (
                        <option
                          key={cause}
                          value={cause}
                        >
                          {cause}
                        </option>
                      )
                    )}

                  </select>

                </div>


                {/* MONEY + ACTION */}
                <div className="flex items-center justify-between lg:justify-end gap-3">

                  <p className="font-mono text-[13.5px] font-semibold text-content-100 shrink-0">
                    {rm(parcel.amount)}
                  </p>


                  <div className="flex gap-1.5 shrink-0">

                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"

                        onClick={() =>
                          update(parcel, {
                            status:
                              "Dah Hubungi — Akan Terima",

                            contactedAt:
                              new Date()
                                .toISOString()
                                .slice(
                                  0,
                                  10
                                ),
                          })
                        }

                        className="
                          flex
                          items-center
                          bg-stamp-green/10
                          text-stamp-green
                          border
                          border-stamp-green/40
                          rounded-lg
                          px-3
                          py-2
                          min-h-[36px]
                          text-[12px]
                          font-medium
                          hover:bg-stamp-green/20
                          transition-colors
                        "
                      >
                        WhatsApp
                      </a>
                    )}


                    <button
                      onClick={() =>
                        setOpen(
                          isOpen
                            ? null
                            : key
                        )
                      }
                      className="btn-soft px-2.5"
                      aria-label="Butiran parcel"
                    >
                      {isOpen
                        ? "▲"
                        : "▼"}
                    </button>

                  </div>

                </div>

              </div>


              {/* EXPANDED DETAIL */}
              {isOpen && (

                <div className="border-t border-surface-600 bg-surface-950/40 px-3.5 py-4 space-y-4">

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">

                    <Meta
                      label="Telefon"
                      value={parcel.phone}
                      mono
                    />

                    <Meta
                      label="Tracking"
                      value={
                        parcel.trackingNo
                      }
                      mono
                    />

                    <Meta
                      label="Ejen"
                      value={
                        parcel.agent ||
                        "—"
                      }
                    />

                    <Meta
                      label="Kawasan"
                      value={
                        parcel.region ||
                        "—"
                      }
                    />

                  </div>


                  <div>

                    <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
                      Imbasan terakhir
                    </p>


                    <p className="text-[12.5px] text-content-100/85 mt-0.5">
                      {parcel.lastScanLabel ||
                        "Tiada maklumat"}
                    </p>

                  </div>


                  {/* STATUS ACTION */}
                  <div className="flex flex-wrap gap-2">

                    <button
                      onClick={() =>
                        update(parcel, {
                          status:
                            "Confirmation Reply",
                        })
                      }
                      className="
                        btn-soft
                        text-stamp-green
                        border-stamp-green/40
                        hover:bg-stamp-green/10
                      "
                    >
                      Confirmation Reply
                    </button>


                    <button
                      onClick={() =>
                        update(parcel, {
                          status:
                            "Confirmation Tidak Reply",
                        })
                      }
                      className="btn-soft"
                    >
                      Confirmation Tidak Reply
                    </button>


                    <button
                      onClick={() =>
                        update(parcel, {
                          status:
                            "Selamat — Sampai",
                        })
                      }
                      className="
                        btn-soft
                        text-stamp-green
                        border-stamp-green/40
                        hover:bg-stamp-green/10
                      "
                    >
                      ✓ Selamat — Sampai
                    </button>


                    <button
                      onClick={() =>
                        update(parcel, {
                          status:
                            "Minta Hantar Semula",
                        })
                      }
                      className="btn-soft"
                    >
                      Minta Hantar Semula
                    </button>


                    <button
                      onClick={() =>
                        update(parcel, {
                          status:
                            "Cancel Order",
                        })
                      }
                      className="
                        btn-soft
                        text-stamp-red
                        border-stamp-red/40
                        hover:bg-stamp-red/10
                      "
                    >
                      Cancel Order
                    </button>


                    <button
                      onClick={() =>
                        update(parcel, {
                          status:
                            "Tak Dapat Dihubungi",
                        })
                      }
                      className="btn-soft"
                    >
                      Tak Dapat Dihubungi
                    </button>


                    <button
                      onClick={() =>
                        update(parcel, {
                          status:
                            "Belum Hubungi",
                        })
                      }
                      className="btn-soft"
                    >
                      Reset
                    </button>

                  </div>


                  {/* CATATAN */}
                  <label className="block">

                    <span className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
                      Catatan
                    </span>


                    <input
                      value={
                        rec.note ?? ""
                      }

                      onChange={(e) =>
                        update(parcel, {
                          note:
                            e.target.value,
                        })
                      }

                      placeholder="Contoh: customer minta hantar hujung minggu"

                      className="input mt-1"
                    />

                  </label>

                </div>

              )}

            </div>
          );
        })}

      </div>


      {/* SHOW ALL */}
      {visible.length > 12 && (

        <button
          onClick={() =>
            setShowAll(
              (current) =>
                !current
            )
          }
          className="btn-soft mt-3"
        >
          {showAll
            ? "Tunjuk kurang"
            : `Tunjuk semua ${visible.length} parcel`}
        </button>

      )}


      {/* FOOTER */}
      <p className="text-content-300/60 text-[11.5px] mt-4 leading-relaxed">

        Status dan Punca Return disimpan
        dalam browser komputer ini.
        Pilihan Punca Return menggunakan
        senarai yang sama dengan sub-tab{" "}
        <strong>Punca Return</strong>. Tanda status{" "}
        <strong>Confirmation Reply</strong>,{" "}
        <strong>Confirmation Tidak Reply</strong> atau{" "}
        <strong>Cancel Order</strong> akan auto-isi Punca
        Return sekali — tak payah pilih dua kali.

      </p>

    </div>
  );
}


/*
 * Small summary box.
 */
function Stat({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "ink" | "amber" | "green" | "red";
}) {

  const colour =
    tone === "amber"
      ? "text-stamp-amber"
      : tone === "green"
      ? "text-stamp-green"
      : tone === "red"
      ? "text-stamp-red"
      : "text-content-100";


  return (
    <div className="border border-surface-600 rounded-lg px-3 py-2.5">

      <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/60">
        {label}
      </p>


      <p
        className={`
          font-display
          font-extrabold
          text-[1.3rem]
          leading-none
          mt-1
          ${colour}
        `}
      >
        {value}
      </p>


      {sub && (
        <p className="text-[10.5px] text-content-300/60 mt-1">
          {sub}
        </p>
      )}

    </div>
  );
}


/*
 * Detail field.
 */
function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {

  return (
    <div>

      <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
        {label}
      </p>


      <p
        className={`
          mt-0.5
          text-content-100/90

          ${
            mono
              ? "font-mono text-[11.5px]"
              : "text-[12.5px]"
          }
        `}
      >
        {value}
      </p>

    </div>
  );
}

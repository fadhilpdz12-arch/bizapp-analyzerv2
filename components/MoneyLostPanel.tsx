import { MoneyLost } from "@/lib/types";

function LossList({ title, buckets }: { title: string; buckets: MoneyLost["byProduct"] }) {
  const top = buckets.slice(0, 5);
  const max = Math.max(...top.map((b) => b.lostAmount), 1);
  return (
    <div>
      <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-content-300/40 mb-3">{title}</p>
      <div className="space-y-2.5">
        {top.map((b, i) => (
          <div key={b.label + i}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[12.5px] text-content-100/85 truncate">{b.label}</span>
              <span className="font-mono text-[11.5px] text-stamp-red shrink-0">
                RM{b.lostAmount.toLocaleString()}
                <span className="text-content-300/35"> · {b.returnedOrders}</span>
              </span>
            </div>
            <div className="h-1 rounded-full bg-surface-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-stamp-red/70"
                style={{ width: `${Math.max((b.lostAmount / max) * 100, 3)}%` }}
              />
            </div>
          </div>
        ))}
        {top.length === 0 && <p className="text-[12.5px] text-content-300/40">Tiada data.</p>}
      </div>
    </div>
  );
}

export default function MoneyLostPanel({ data }: { data: MoneyLost }) {
  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <div className="flex items-center justify-between mb-5">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
          Duit Hangus Sebab Return
        </p>
        <span className="barcode w-14 h-3 text-content-300/40" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div>
          <p className="font-mono text-[10px] text-content-300/45 uppercase tracking-wider">Nilai Barang</p>
          <p className="font-display font-extrabold text-2xl text-content-100 mt-1">
            RM {data.totalLost.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-content-300/45 uppercase tracking-wider">Kos Kurier Terbuang</p>
          <p className="font-display font-extrabold text-2xl text-content-100 mt-1">
            RM {data.estimatedShippingWaste.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-content-300/45 uppercase tracking-wider">Jumlah Kerugian</p>
          <p className="font-display font-extrabold text-2xl text-stamp-red mt-1">
            RM {data.totalWithShipping.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="ticket-tear pt-5 grid grid-cols-1 md:grid-cols-3 gap-6">
        <LossList title="Ikut Produk" buckets={data.byProduct} />
        <LossList title="Ikut Kawasan" buckets={data.byRegion} />
        <LossList title="Ikut Bulan" buckets={data.byMonth} />
      </div>

      <p className="text-[11.5px] text-content-300/35 mt-5 leading-relaxed">
        Kos kurier dikira pada anggaran RM{data.shippingCostPerReturn} sepasang (hantar + pulang).
        Laraskan angka ini kalau kadar sebenar kitak berbeza.
      </p>
    </div>
  );
}

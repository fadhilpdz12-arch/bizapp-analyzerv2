import { CustomerInsight } from "@/lib/types";

export default function CustomerPanel({ data }: { data: CustomerInsight }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Repeat + top spenders */}
      <div className="ticket p-5 sm:p-6 fade-up">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50 mb-5">
          Pelanggan & Nilai Seumur Hidup
        </p>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <p className="font-mono text-[9.5px] text-content-300/45 uppercase tracking-wider">Pelanggan Unik</p>
            <p className="font-display font-extrabold text-2xl text-content-100 mt-1">
              {data.uniqueCustomers.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="font-mono text-[9.5px] text-content-300/45 uppercase tracking-wider">Repeat Rate</p>
            <p
              className={`font-display font-extrabold text-2xl mt-1 ${
                data.repeatRate < 15 ? "text-stamp-amber" : "text-stamp-green"
              }`}
            >
              {data.repeatRate}%
            </p>
          </div>
          <div>
            <p className="font-mono text-[9.5px] text-content-300/45 uppercase tracking-wider">Beli Berulang</p>
            <p className="font-display font-extrabold text-2xl text-content-100 mt-1">
              {data.repeatCustomers.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="ticket-tear pt-4 mb-5 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[12.5px] text-content-300/55">
            Purata belanja pelanggan berulang{" "}
            <span className="text-stamp-green font-mono">RM{data.avgSpendRepeat.toLocaleString()}</span> lawan
            sekali beli <span className="font-mono text-content-300/70">RM{data.avgSpendOnce.toLocaleString()}</span>
          </p>
        </div>

        <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-content-300/40 mb-3">
          Pelanggan Paling Bernilai
        </p>
        <div className="space-y-2">
          {data.topCustomers.map((c, i) => (
            <div key={c.phoneKey + i} className="flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="text-content-100/85 truncate">{c.name}</span>
              <span className="font-mono text-accent shrink-0">
                RM{c.totalSpend.toLocaleString()}
                <span className="text-content-300/35"> · {c.orders} order</span>
              </span>
            </div>
          ))}
          {data.topCustomers.length === 0 && (
            <p className="text-[12.5px] text-content-300/40">Tiada nombor telefon sah dalam data.</p>
          )}
        </div>
      </div>

      {/* Serial returners */}
      <div className="ticket p-5 sm:p-6 fade-up">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
              Senarai Pantau — Serial Returner
            </p>
            <p className="text-[12.5px] text-content-300/50 mt-1.5 max-w-xs leading-relaxed">
              Pelanggan dengan 2 atau lebih return. Pertimbang prepaid sahaja untuk mereka.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display font-extrabold text-2xl text-stamp-red leading-none">
              {data.serialReturners.length}
            </p>
            <p className="font-mono text-[10px] text-content-300/45 mt-1">
              RM{data.wastedBySerial.toLocaleString()} hangus
            </p>
          </div>
        </div>

        {data.serialReturners.length === 0 ? (
          <p className="text-[13px] text-stamp-green mt-4">Tiada pelanggan yang return berulang kali.</p>
        ) : (
          <div className="overflow-x-auto scroll-hint mt-4">
            <table className="w-full text-[12.5px] min-w-[300px]">
              <thead>
                <tr className="text-content-300/40 font-mono text-[9.5px] uppercase tracking-wider border-b border-surface-600">
                  <th className="text-left font-medium pb-2">Pelanggan</th>
                  <th className="text-left font-medium pb-2">Telefon</th>
                  <th className="text-right font-medium pb-2">Order</th>
                  <th className="text-right font-medium pb-2">Return</th>
                </tr>
              </thead>
              <tbody>
                {data.serialReturners.slice(0, 10).map((c, i) => (
                  <tr key={c.phoneKey + i} className="border-b border-surface-700/60 last:border-0">
                    <td className="py-2.5 text-content-100/85 truncate max-w-[150px]">{c.name}</td>
                    <td className="py-2.5 font-mono text-content-300/55">{c.phoneKey}</td>
                    <td className="py-2.5 text-right font-mono text-content-300/70">{c.orders}</td>
                    <td className="py-2.5 text-right font-mono text-stamp-red">{c.returned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

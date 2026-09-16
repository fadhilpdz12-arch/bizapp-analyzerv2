const STATUS_COLOR: Record<string, string> = {
  COLLECTED: "text-stamp-green",
  RETURN: "text-stamp-red",
  PENDING: "text-stamp-amber",
  BATAL: "text-stamp-slate",
};

const STATUS_LABEL: Record<string, string> = {
  COLLECTED: "Collected",
  RETURN: "Return",
  PENDING: "Pending",
  BATAL: "Batal",
};

export default function StampBadge({ status, tilt = false }: { status: string; tilt?: boolean }) {
  const color = STATUS_COLOR[status] || "text-content-300";
  const label = STATUS_LABEL[status] || status;
  return (
    <span className={`stamp text-[11px] ${color} ${tilt ? "stamp-tilt-r" : ""}`}>
      {label}
    </span>
  );
}

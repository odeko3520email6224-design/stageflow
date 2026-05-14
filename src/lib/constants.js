// 時間帯の共通定数
export const TIME_SLOTS = ["開場前", "開演中", "終演後"];

export const TIME_SLOT_STYLES = {
  "開場前": {
    header: "bg-amber-50 border-amber-200 text-amber-800",
    badge: "bg-amber-50 border-amber-200 text-amber-800",
    bg: "bg-amber-100 text-amber-800 border-amber-300",
    dot: "bg-amber-400",
  },
  "開演中": {
    header: "bg-blue-50 border-blue-200 text-blue-800",
    badge: "bg-blue-50 border-blue-200 text-blue-800",
    bg: "bg-blue-100 text-blue-800 border-blue-300",
    dot: "bg-blue-400",
  },
  "終演後": {
    header: "bg-slate-50 border-slate-200 text-slate-700",
    badge: "bg-slate-50 border-slate-200 text-slate-700",
    bg: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "bg-slate-400",
  },
};
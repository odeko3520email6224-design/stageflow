// 時間帯の共通定数
export const TIME_SLOTS = ["開場前", "開演中", "終演後"];

export const TIME_SLOT_STYLES = {
  "開場前": {
    header: "bg-amber-200 border-amber-400 text-amber-950 dark:bg-amber-800 dark:border-amber-500 dark:text-white",
    badge: "bg-amber-200 border-amber-400 text-amber-950 dark:bg-amber-800 dark:border-amber-500 dark:text-white",
    bg: "bg-amber-200 text-amber-950 border-amber-400 dark:bg-amber-800 dark:border-amber-500 dark:text-white",
    dot: "bg-amber-600",
  },
  "開演中": {
    header: "bg-blue-200 border-blue-400 text-blue-950 dark:bg-blue-800 dark:border-blue-500 dark:text-white",
    badge: "bg-blue-200 border-blue-400 text-blue-950 dark:bg-blue-800 dark:border-blue-500 dark:text-white",
    bg: "bg-blue-200 text-blue-950 border-blue-400 dark:bg-blue-800 dark:border-blue-500 dark:text-white",
    dot: "bg-blue-600",
  },
  "終演後": {
    header: "bg-slate-300 border-slate-500 text-slate-900 dark:bg-slate-600 dark:border-slate-400 dark:text-white",
    badge: "bg-slate-300 border-slate-500 text-slate-900 dark:bg-slate-600 dark:border-slate-400 dark:text-white",
    bg: "bg-slate-300 text-slate-900 border-slate-500 dark:bg-slate-600 dark:border-slate-400 dark:text-white",
    dot: "bg-slate-600",
  },
};
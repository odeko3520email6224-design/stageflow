// 時間帯の共通定数
export const TIME_SLOTS = ["開場前", "開演中", "終演後"];

export const TIME_SLOT_STYLES = {
  "開場前": {
    header: "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/50 dark:border-amber-600 dark:text-amber-200",
    badge: "bg-amber-100 border-amber-300 text-amber-900 dark:bg-amber-900/50 dark:border-amber-600 dark:text-amber-200",
    bg: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/50 dark:border-amber-600 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  "開演中": {
    header: "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/50 dark:border-blue-600 dark:text-blue-200",
    badge: "bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/50 dark:border-blue-600 dark:text-blue-200",
    bg: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-900/50 dark:border-blue-600 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  "終演後": {
    header: "bg-slate-200 border-slate-400 text-slate-800 dark:bg-slate-700/60 dark:border-slate-500 dark:text-slate-100",
    badge: "bg-slate-200 border-slate-400 text-slate-800 dark:bg-slate-700/60 dark:border-slate-500 dark:text-slate-100",
    bg: "bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-700/60 dark:border-slate-500 dark:text-slate-100",
    dot: "bg-slate-500",
  },
};
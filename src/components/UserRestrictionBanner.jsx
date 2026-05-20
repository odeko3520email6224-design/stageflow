import { AlertTriangle } from "lucide-react";

export default function UserRestrictionBanner({ role }) {
  if (role !== "user") return null;

  return (
    <div className="mb-2 rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-red-900 shadow-sm dark:border-red-500 dark:bg-red-950/50 dark:text-red-100">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
        <div className="min-w-0 text-xs font-bold leading-relaxed">
          <p className="text-sm">機能・表示内容制限中</p>
          <p>※不用意にこのURLを共有しないでください※</p>
          <p>※すべてのアクセスは記録、管理されています※</p>
        </div>
      </div>
    </div>
  );
}

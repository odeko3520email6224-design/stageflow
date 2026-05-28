import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, X, Bell, ShieldAlert } from "lucide-react";
import { LIVE_SYNC_INTERVAL } from "@/lib/liveSync";

const PRIORITY_STYLES = {
  "緊急": { bar: "bg-red-600 text-white", icon: ShieldAlert, label: "緊急" },
  "重要": { bar: "bg-amber-500 text-white", icon: AlertTriangle, label: "重要" },
  "通常": { bar: "bg-primary text-primary-foreground", icon: Bell, label: "お知らせ" },
};

export default function AnnouncementAlert({ eventId }) {
  const [dismissed, setDismissed] = useState(new Set());

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getStaffList", { eventId });
      return res?.data?.staff ?? [];
    },
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements-alert", eventId],
    queryFn: () => base44.entities.Announcement.filter({ event_id: eventId, is_alert: true }),
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const visible = announcements.filter((a) => {
    if (dismissed.has(a.id)) return false;
    const totalTargets = a.target_staff?.length > 0 ? a.target_staff.length : staffList.length;
    const readCount = (a.read_by || []).length;
    if (totalTargets > 0 && readCount >= totalTargets) return false;
    return true;
  });

  if (visible.length === 0) return null;

  return (
    <div className="space-y-1">
      {visible.map((a) => {
        const style = PRIORITY_STYLES[a.priority] || PRIORITY_STYLES["通常"];
        const Icon = style.icon;
        return (
          <div key={a.id} className={`flex items-start gap-2 px-4 py-2.5 ${style.bar}`}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
            <div className="flex-1 min-w-0">
              <span className="font-bold text-xs mr-2">[{style.label}]</span>
              <span className="font-semibold text-sm">{a.title}</span>
              {a.body && <p className="text-xs mt-0.5 opacity-90 line-clamp-2">{a.body}</p>}
            </div>
            <button onClick={() => setDismissed((prev) => new Set([...prev, a.id]))}
              className="shrink-0 opacity-80 hover:opacity-100 transition-opacity p-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
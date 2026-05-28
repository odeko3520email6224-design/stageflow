import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Clock, CalendarClock } from "lucide-react";
import { TIME_SLOTS, TIME_SLOT_STYLES } from "@/lib/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { getStaffDisplayName } from "@/lib/staffName";
import { LIVE_SYNC_INTERVAL } from "@/lib/liveSync";

export default function StaffTimeline({ eventId }) {
  const { role } = useUserRole();
  const shouldMaskStaffNames = role !== "admin" && role !== "chief";

  const { data: positions = [], isLoading: loadingPos } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getPositionList", { eventId });
      return res?.data?.positions ?? [];
    },
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getStaffList", { eventId });
      return res?.data?.staff ?? [];
    },
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  if (loadingPos || loadingStaff) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Build per-staff timeline: { staffName -> { slot -> [positionNames] } }
  const staffTimeline = {};

  staffList.forEach((s) => {
    staffTimeline[s.name] = { "開場中": [], "開演中": [], "終演後": [] };
  });

  positions.forEach((pos) => {
    const slot = pos.time_slot || "開場中";
    (pos.staff_names || []).forEach((name) => {
      if (!staffTimeline[name]) {
        staffTimeline[name] = { "開場中": [], "開演中": [], "終演後": [] };
      }
      if (!staffTimeline[name][slot]) {
        staffTimeline[name][slot] = [];
      }
      staffTimeline[name][slot].push(pos.name || pos.role);
    });
  });

  const allNames = Object.keys(staffTimeline).sort();

  // 全時間帯合計（重複なし）
  const totalAssigned = [...new Set(positions.flatMap((p) => p.staff_names || []))].length;

  if (allNames.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="font-medium">スタッフが登録されていません</p>
        <p className="text-sm mt-1">スタッフ管理タブからスタッフを登録してください</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-bold flex items-center gap-1.5 flex-1 min-w-0"><CalendarClock className="w-4 h-4 text-primary" />担当者別タイムライン</h2>
        <span className="text-sm font-medium text-foreground shrink-0">
          全時間帯：{totalAssigned}名配置済み
        </span>
      </div>

      {/* Always show desktop grid table, with horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-2 px-2">
        <div style={{ minWidth: "480px" }}>
          <div className="grid grid-cols-4 gap-1.5 mb-1.5 px-1">
            <div className="text-xs font-semibold text-muted-foreground">スタッフ</div>
            {TIME_SLOTS.map((slot) => (
              <div key={slot} className={`text-xs font-semibold px-2 py-1 rounded-lg border text-center ${TIME_SLOT_STYLES[slot].bg}`}>
                {slot}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {allNames.map((name) => {
              const timeline = staffTimeline[name];
              const displayName = getStaffDisplayName(name, shouldMaskStaffNames);
              const hasAnyAssignment = TIME_SLOTS.some((s) => timeline[s].length > 0);
              return (
                <div key={name} className={`grid grid-cols-4 gap-1.5 bg-card border rounded-lg px-2 py-1 items-start ${!hasAnyAssignment ? "border-amber-200 bg-amber-50/30" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {displayName.charAt(0)}
                    </div>
                    <span className="text-xs font-medium truncate">{displayName}</span>
                  </div>
                  {TIME_SLOTS.map((slot) => (
                    <div key={slot} className="min-h-[1.5rem]">
                      {timeline[slot].length === 0 ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <div className="space-y-0.5">
                          {timeline[slot].map((posName, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${TIME_SLOT_STYLES[slot].dot}`} />
                              <span className="text-xs truncate">{posName}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Clock, CalendarClock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePDFExport } from "@/hooks/usePDFExport";
import { TIME_SLOTS, TIME_SLOT_STYLES } from "@/lib/constants";

export default function StaffTimeline({ eventId }) {
  const { exporting: exportingPDF, exportPDF: handleExportPDF } = usePDFExport(eventId, "timeline", "タイムライン");

  const { data: positions = [], isLoading: loadingPos } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }),
  });

  const { data: staffList = [], isLoading: loadingStaff } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
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
    staffTimeline[s.name] = { "開場前": [], "開演中": [], "終演後": [] };
  });

  positions.forEach((pos) => {
    const slot = pos.time_slot || "開場前";
    (pos.staff_names || []).forEach((name) => {
      if (!staffTimeline[name]) {
        staffTimeline[name] = { "開場前": [], "開演中": [], "終演後": [] };
      }
      staffTimeline[name][slot].push(pos.name || pos.role);
    });
  });

  const allNames = Object.keys(staffTimeline).sort();

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
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-6">
        <h2 className="text-sm font-bold flex items-center gap-1.5 flex-1"><CalendarClock className="w-4 h-4 text-primary" />担当者別タイムライン</h2>
        <div className="flex items-center gap-3 sm:ml-auto shrink-0">
          <span className="text-sm text-muted-foreground">{allNames.length}名</span>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={handleExportPDF} disabled={exportingPDF || allNames.length === 0}>
            <Download className="w-3 h-3" />
            {exportingPDF ? 'エクスポート中...' : 'PDF出力'}
          </Button>
        </div>
      </div>

      {/* Always show desktop grid table, with horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-2 px-2">
        <div style={{ minWidth: "480px" }}>
          <div className="grid grid-cols-4 gap-2 mb-2 px-1">
            <div className="text-xs font-semibold text-muted-foreground">スタッフ</div>
            {TIME_SLOTS.map((slot) => (
              <div key={slot} className={`text-xs font-semibold px-2 py-1 rounded-lg border text-center ${TIME_SLOT_STYLES[slot].bg}`}>
                {slot}
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {allNames.map((name) => {
              const timeline = staffTimeline[name];
              const hasAnyAssignment = TIME_SLOTS.some((s) => timeline[s].length > 0);
              return (
                <div key={name} className={`grid grid-cols-4 gap-2 bg-card border rounded-xl px-3 py-2 items-start ${!hasAnyAssignment ? "border-amber-200 bg-amber-50/30" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {name.charAt(0)}
                    </div>
                    <span className="text-xs font-medium truncate">{name}</span>
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
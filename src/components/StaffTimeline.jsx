import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Clock, CalendarClock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const TIME_SLOTS = ["開場前", "開演中", "終演後"];

const TIME_SLOT_STYLES = {
  "開場前": { bg: "bg-amber-100 text-amber-800 border-amber-300", dot: "bg-amber-400" },
  "開演中": { bg: "bg-blue-100 text-blue-800 border-blue-300", dot: "bg-blue-400" },
  "終演後": { bg: "bg-slate-100 text-slate-700 border-slate-300", dot: "bg-slate-400" },
};

export default function StaffTimeline({ eventId }) {
  const [exportingPDF, setExportingPDF] = useState(false);

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const response = await base44.functions.invoke('exportPositionPDF', { eventId, type: 'timeline' });
      const html = response.data.html;
      
      // Create iframe to render HTML
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
      
      // Wait for fonts to load, then generate PDF
      setTimeout(() => {
        import('html2canvas').then(({ default: html2canvas }) => {
          import('jspdf').then(({ jsPDF }) => {
            html2canvas(iframe.contentDocument.body, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff'
            }).then((canvas) => {
              if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
                alert('ページのレンダリングに失敗しました');
                document.body.removeChild(iframe);
                return;
              }
              
              const imgData = canvas.toDataURL('image/jpeg', 0.95);
              const imgWidth = 210;
              const imgHeight = canvas.height > 0 ? (canvas.height * imgWidth) / canvas.width : 297;
              
              if (!isFinite(imgHeight) || imgHeight <= 0) {
                alert('サイズ計算に失敗しました');
                document.body.removeChild(iframe);
                return;
              }
              
              const doc = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4'
              });
              
              const pageHeight = 297;
              doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
              
              let yOffset = pageHeight;
              while (yOffset < imgHeight) {
                doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, -yOffset, imgWidth, imgHeight);
                yOffset += pageHeight;
              }
              
              doc.save(`タイムライン_${new Date().toISOString().split('T')[0]}.pdf`);
              document.body.removeChild(iframe);
            });
          });
        });
      }, 2000);
    } finally {
      setExportingPDF(false);
    }
  };

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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2"><CalendarClock className="w-5 h-5 text-primary" />担当者別タイムライン</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{allNames.length}名</span>
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={handleExportPDF} disabled={exportingPDF || allNames.length === 0}>
            <Download className="w-3 h-3" />
            {exportingPDF ? 'エクスポート中...' : 'PDF出力'}
          </Button>
        </div>
      </div>

      {/* Mobile: card per staff / Desktop: grid */}
      <div className="block md:hidden space-y-2">
        {allNames.map((name) => {
          const timeline = staffTimeline[name];
          const hasAnyAssignment = TIME_SLOTS.some((s) => timeline[s].length > 0);
          return (
            <div key={name} className={`bg-card border rounded-xl px-3 py-2.5 ${!hasAnyAssignment ? "border-amber-200 bg-amber-50/30" : "border-border"}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                  {name.charAt(0)}
                </div>
                <span className="text-sm font-semibold">{name}</span>
              </div>
              <div className="space-y-1 pl-8">
                {TIME_SLOTS.map((slot) => timeline[slot].length > 0 && (
                  <div key={slot} className="flex items-start gap-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${TIME_SLOT_STYLES[slot].bg}`}>{slot}</span>
                    <span className="text-xs">{timeline[slot].join("、")}</span>
                  </div>
                ))}
                {!hasAnyAssignment && <span className="text-xs text-muted-foreground">未配置</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: grid table */}
      <div className="hidden md:block">
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
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle, ClipboardList, Download, BookOpen } from "lucide-react";
import PositionFormModal from "@/components/PositionFormModal";
import PositionCard from "@/components/PositionCard";
import { useUserRole } from "@/hooks/useUserRole";

const TIME_SLOTS = ["開場前", "開演中", "終演後"];

const TIME_SLOT_STYLES = {
  "開場前": { header: "bg-amber-50 border-amber-200 text-amber-800" },
  "開演中": { header: "bg-blue-50 border-blue-200 text-blue-800" },
  "終演後": { header: "bg-slate-50 border-slate-200 text-slate-700" },
};

export default function StaffList({ eventId }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultSlot, setDefaultSlot] = useState("開場前");
  const [exportingPDF, setExportingPDF] = useState(false);
  const queryClient = useQueryClient();
  const { canEdit: isAdmin } = useUserRole();

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }),
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }),
    select: (d) => d[0],
  });

  const { data: activePreset } = useQuery({
    queryKey: ["positionPreset", event?.active_preset_id],
    queryFn: () => base44.entities.PositionPreset.filter({ id: event.active_preset_id }),
    enabled: !!event?.active_preset_id,
    select: (d) => d[0],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Position.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positions", eventId] }),
  });

  const grouped = TIME_SLOTS.reduce((acc, slot) => {
    acc[slot] = positions.filter((p) => (p.time_slot || "開場前") === slot);
    return acc;
  }, {});

  const openAdd = (slot) => {
    setDefaultSlot(slot);
    setEditing(null);
    setShowModal(true);
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const response = await base44.functions.invoke('exportPositionPDF', { eventId, type: 'staff' });
      if (response.data.error) {
        alert('エラー: ' + response.data.error);
        setExportingPDF(false);
        return;
      }
      const html = response.data.html;
      
      // Create temporary container
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.width = '210mm';
      container.style.backgroundColor = 'white';
      container.innerHTML = html;
      document.body.appendChild(container);
      
      // Wait for fonts to load
      setTimeout(() => {
        import('html2canvas').then(({ default: html2canvas }) => {
          import('jspdf').then(({ jsPDF }) => {
            html2canvas(container, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              allowTaint: true
            }).then((canvas) => {
              if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
                throw new Error('Canvas render failed');
              }
              
              const imgData = canvas.toDataURL('image/jpeg', 0.95);
              const imgWidth = 210;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              
              if (!isFinite(imgHeight) || imgHeight <= 0) {
                throw new Error('Invalid dimensions');
              }
              
              const doc = new jsPDF('l', 'mm', 'a4');
              const pageHeight = 297;
              let yPos = 0;
              
              doc.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
              yPos += imgHeight;
              
              while (yPos < imgHeight) {
                doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, yPos - imgHeight, imgWidth, imgHeight);
                yPos += pageHeight;
              }
              
              doc.save(`配置表_${new Date().toISOString().split('T')[0]}.pdf`);
              document.body.removeChild(container);
              setExportingPDF(false);
            }).catch((error) => {
              console.error('Rendering error:', error);
              alert('PDF作成に失敗しました');
              document.body.removeChild(container);
              setExportingPDF(false);
            });
          });
        });
      }, 1500);
    } catch (error) {
      console.error('Export error:', error);
      alert('エラーが発生しました: ' + error.message);
      setExportingPDF(false);
    }
  };

  return (
    <div>
      {activePreset && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-primary text-xs font-medium">
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span>適用中プリセット：{activePreset.name}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" />配置表</h2>
        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={handleExportPDF} disabled={exportingPDF || isLoading || positions.length === 0}>
          <Download className="w-3 h-3" />
          {exportingPDF ? 'エクスポート中...' : 'PDF出力'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {TIME_SLOTS.map((slot) => {
            const style = TIME_SLOT_STYLES[slot];
            return (
              <div key={slot} className={`border rounded-xl overflow-hidden ${style.header.split(" ").slice(0, 2).join(" ")}`}>
                {/* Section header */}
                <div className={`flex items-center justify-between px-4 py-2 border-b ${style.header}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{slot}</span>
                    <span className="text-xs opacity-70">{grouped[slot].length}件</span>
                  </div>
                  <button
                    onClick={() => openAdd(slot)}
                    disabled={!isAdmin}
                    className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/60 hover:bg-white/90 transition-colors font-medium disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Plus className="w-3 h-3" />追加
                  </button>
                </div>

                {/* Positions */}
                <div className="bg-card p-3">
                  {grouped[slot].length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">このタイムスロットにポジションがありません</p>
                  ) : (
                    <div className="grid gap-1.5">
                      {grouped[slot].map((pos) => (
                        <PositionCard
                          key={pos.id}
                          pos={pos}
                          isAdmin={isAdmin}
                          onEdit={(p) => { setEditing(p); setShowModal(true); }}
                          onDelete={(id) => { if (confirm("削除しますか？")) deleteMutation.mutate(id); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned staff */}
      {(() => {
        const assignedNames = new Set(positions.flatMap((p) => p.staff_names || []));
        const unassigned = staffList.filter((s) => !assignedNames.has(s.name));
        if (unassigned.length === 0) return null;
        return (
          <div className="mt-3 border border-amber-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="font-bold text-sm">未配置スタッフ</span>
              <span className="text-xs opacity-70">{unassigned.length}名</span>
            </div>
            <div className="bg-card p-3 grid gap-1.5">
              {unassigned.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-amber-50/50 border border-amber-100">
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{s.name}</span>
                  {s.note && <span className="text-xs text-muted-foreground">{s.note}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {showModal && (
        <PositionFormModal
          position={editing}
          eventId={eventId}
          defaultTimeSlot={defaultSlot}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
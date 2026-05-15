import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertCircle, ClipboardList, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import PositionCard from "@/components/PositionCard";
import PositionFormModal from "@/components/PositionFormModal";
import { useUserRole } from "@/hooks/useUserRole";
import { usePDFExport } from "@/hooks/usePDFExport";
import { TIME_SLOTS, TIME_SLOT_STYLES } from "@/lib/constants";
import PresetSelector from "@/components/PresetSelector";

export default function StaffDragDropManager({ eventId }) {
  const queryClient = useQueryClient();
  const { canEdit } = useUserRole();
  const isAdmin = canEdit;

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }),
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }),
    select: (d) => d[0],
  });

  const updatePositionMutation = useMutation({
    mutationFn: ({ positionId, staffNames }) =>
      base44.entities.Position.update(positionId, { staff_names: staffNames }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    },
  });

  const { exporting: exportingPDF, exportPDF: handleExportPDF } = usePDFExport(eventId, "staff", "配置表");

  const [draggedStaff, setDraggedStaff] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultSlot, setDefaultSlot] = useState("開場前");

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Position.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positions", eventId] }),
  });

  const openAdd = (slot) => {
    setDefaultSlot(slot);
    setEditing(null);
    setShowModal(true);
  };

  const handleDragStart = (e, staffName) => {
    setDraggedStaff(staffName);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, positionId) => {
    e.preventDefault();
    if (!draggedStaff) return;

    const position = positions.find((p) => p.id === positionId);
    if (!position) return;

    const currentStaffNames = position.staff_names || [];
    if (currentStaffNames.includes(draggedStaff)) {
      setDraggedStaff(null);
      return;
    }

    const updatedStaffNames = [...currentStaffNames, draggedStaff];
    updatePositionMutation.mutate({
      positionId: positionId,
      staffNames: updatedStaffNames,
    });
    setDraggedStaff(null);
  };

  const handleDropUnassigned = (e) => {
    e.preventDefault();
    setDraggedStaff(null);
  };

  const removeStaffFromPosition = (positionId, staffName) => {

    const position = positions.find((p) => p.id === positionId);
    if (!position) return;

    const updatedStaffNames = (position.staff_names || []).filter(
      (name) => name !== staffName
    );
    updatePositionMutation.mutate({
      positionId: positionId,
      staffNames: updatedStaffNames,
    });
  };

  const grouped = TIME_SLOTS.reduce((acc, slot) => {
    acc[slot] = positions.filter((p) => (p.time_slot || "開場前") === slot);
    return acc;
  }, {});

  const assignedNames = new Set(positions.flatMap((p) => p.staff_names || []));
  const unassigned = staffList.filter((s) => !assignedNames.has(s.name));

  return (
    <div>
      <PresetSelector eventId={eventId} />

      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-0.5"><ClipboardList className="w-4 h-4 text-primary" />配置表</h2>
          <p className="text-[11px] text-muted-foreground">スタッフそれぞれの配置管理が可能です。スマホ、タブレットなどでは、各スタッフをドラッグ&ドロップで配置することも可能です。</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={handleExportPDF} disabled={exportingPDF || positions.length === 0}>
          <Download className="w-3 h-3" />
          {exportingPDF ? 'エクスポート中...' : 'PDF出力'}
        </Button>
      </div>

      <div className="space-y-2">
        {TIME_SLOTS.map((slot) => {
          const style = TIME_SLOT_STYLES[slot];
          return (
            <div key={slot} className={`border rounded-xl overflow-hidden ${style.header.split(" ").slice(0, 2).join(" ")}`}>
              {/* Section header */}
              <div className={`flex items-center justify-between px-3 py-1.5 border-b ${style.header}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs">{slot}</span>
                  <span className="text-[10px] opacity-70">{grouped[slot].length}件</span>
                </div>
                <button
                  onClick={() => openAdd(slot)}
                  className="text-[11px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-white/60 hover:bg-white/90 transition-colors font-medium"
                >
                  <Plus className="w-2.5 h-2.5" />追加
                </button>
              </div>

              {/* Positions */}
              <div className="bg-card p-2">
                {grouped[slot].length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-2">ポジションがありません</p>
                ) : (
                  <div className="grid gap-1">
                    {grouped[slot].map((pos) => (
                      <PositionCard
                        key={pos.id}
                        pos={pos}
                        isAdmin={isAdmin}
                        draggable={true}
                        draggedStaff={draggedStaff}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, pos.id)}
                        onStaffDragStart={(e, name, posId) => {
                          handleDragStart(e, name);
                          removeStaffFromPosition(posId, name);
                        }}
                        onStaffRemove={removeStaffFromPosition}
                        onEdit={(p) => { setEditing(p); setShowModal(true); }}
                        onDelete={(id) => { if (confirm("削除しますか？")) deleteMutation.mutate(id); }}
                        emptyLabel="スタッフをドラッグして配置"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unassigned staff */}
      {(() => {
        if (unassigned.length === 0) return null;
        return (
          <div className="mt-2 border border-amber-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-800">
              <AlertCircle className="w-3 h-3" />
              <span className="font-bold text-xs">未配置スタッフ</span>
              <span className="text-[10px] opacity-70">{unassigned.length}名</span>
            </div>
            <div
              className="bg-card p-2 grid gap-1 min-h-[36px]"
              onDragOver={handleDragOver}
              onDrop={handleDropUnassigned}
            >
              {unassigned.map((s) => (
                <div
                  key={s.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, s.name)}
                  className={`flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-50/50 border border-amber-100 cursor-move hover:bg-amber-50 ${draggedStaff === s.name ? "opacity-50" : ""}`}
                >
                  <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-[10px] shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <span className="text-xs font-medium">{s.name}</span>
                  {s.note && <span className="text-[10px] text-muted-foreground">{s.note}</span>}
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
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertCircle, ClipboardList, BookOpen, Plus } from "lucide-react";
import PositionCard from "@/components/PositionCard";
import PositionFormModal from "@/components/PositionFormModal";
import { useUserRole } from "@/hooks/useUserRole";

const TIME_SLOTS = ["開場前", "開演中", "終演後"];

const TIME_SLOT_STYLES = {
  "開場前": { header: "bg-amber-50 border-amber-200 text-amber-800" },
  "開演中": { header: "bg-blue-50 border-blue-200 text-blue-800" },
  "終演後": { header: "bg-slate-50 border-slate-200 text-slate-700" },
};

export default function StaffDragDropManager({ eventId }) {
  const queryClient = useQueryClient();
  const { canEdit: isAdmin } = useUserRole();

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

  const { data: activePreset } = useQuery({
    queryKey: ["positionPreset", event?.active_preset_id],
    queryFn: () => base44.entities.PositionPreset.filter({ id: event.active_preset_id }),
    enabled: !!event?.active_preset_id,
    select: (d) => d[0],
  });

  const updatePositionMutation = useMutation({
    mutationFn: ({ positionId, staffNames }) =>
      base44.entities.Position.update(positionId, { staff_names: staffNames }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    },
  });

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
    if (!isAdmin) {
      e.preventDefault();
      return;
    }
    setDraggedStaff(staffName);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, positionId) => {
    e.preventDefault();
    if (!draggedStaff || !isAdmin) return;

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
    if (!isAdmin) return;

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
      {activePreset && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 text-primary text-xs font-medium">
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span>適用中プリセット：{activePreset.name}</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" />ドラッグ配置表</h2>
      </div>

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
          <div className="mt-3 border border-amber-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="font-bold text-sm">未配置スタッフ</span>
              <span className="text-xs opacity-70">{unassigned.length}名</span>
            </div>
            <div
              className="bg-card p-3 grid gap-1.5 min-h-[40px]"
              onDragOver={handleDragOver}
              onDrop={handleDropUnassigned}
            >
              {unassigned.map((s) => (
                <div
                  key={s.id}
                  draggable={isAdmin}
                  onDragStart={(e) => isAdmin && handleDragStart(e, s.name)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-amber-50/50 border border-amber-100 ${
                    isAdmin ? "cursor-move hover:bg-amber-50" : ""
                  } ${draggedStaff === s.name ? "opacity-50" : ""}`}
                >
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
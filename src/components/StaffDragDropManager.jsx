import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertCircle, ClipboardList, Plus, Download, Users, User } from "lucide-react";
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

  const { data: positionTypes = [] } = useQuery({
    queryKey: ["positionTypes"],
    queryFn: () => base44.entities.PositionType.list(),
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
    onMutate: async ({ positionId, staffNames }) => {
      await queryClient.cancelQueries({ queryKey: ["positions", eventId] });
      const previousPositions = queryClient.getQueryData(["positions", eventId]);
      queryClient.setQueryData(["positions", eventId], (old) =>
        old.map((p) => (p.id === positionId ? { ...p, staff_names: staffNames } : p))
      );
      return { previousPositions };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(["positions", eventId], context.previousPositions);
    },
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
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["positions", eventId] });
      const previousPositions = queryClient.getQueryData(["positions", eventId]);
      queryClient.setQueryData(["positions", eventId], (old) =>
        old.filter((p) => p.id !== id)
      );
      return { previousPositions };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(["positions", eventId], context.previousPositions);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    },
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

  // 3つのスロット全てに配置されていないスタッフのみ未配置とする
  const unassigned = staffList.filter((s) => {
    const slotsWithAssignment = TIME_SLOTS.filter((slot) => {
      return positions.some((p) => (p.time_slot || "開場前") === slot && (p.staff_names || []).includes(s.name));
    });
    return slotsWithAssignment.length < TIME_SLOTS.length;
  });

  return (
    <div>
      <PresetSelector eventId={eventId} />

      <div className="flex flex-col gap-2 mb-2">
        <div className="flex-1">
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-0.5"><ClipboardList className="w-4 h-4 text-primary" />配置表</h2>
          <p className="text-[11px] text-muted-foreground">スタッフそれぞれの配置管理が可能です。</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1 h-9 text-sm w-full" onClick={handleExportPDF} disabled={exportingPDF || positions.length === 0}>
          <Download className="w-3.5 h-3.5" />
          {exportingPDF ? 'エクスポート中...' : 'PDF出力'}
        </Button>
        {/* 全体合計人数 */}
        {positions.length > 0 && (() => {
          const totalAssigned = [...new Set(positions.flatMap((p) => p.staff_names || []))].length;
          return (
            <div className="text-sm font-medium text-foreground">全時間帯合計：{totalAssigned}名配置済み</div>
          );
        })()}
      </div>

      <div className="space-y-2">
        {TIME_SLOTS.map((slot) => {
          const style = TIME_SLOT_STYLES[slot];
          const slotPositions = grouped[slot];
          const slotStaffCount = [...new Set(slotPositions.flatMap((p) => p.staff_names || []))].length;
          return (
            <div key={slot} className={`border rounded-xl overflow-hidden ${style.header.split(" ").slice(0, 2).join(" ")}`}>
              {/* Section header */}
              <div className={`flex items-center justify-between px-3 py-1.5 border-b ${style.header}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs">{slot}</span>
                  <span className="text-[10px] opacity-70">{slotPositions.length}件</span>
                  <span className="text-[10px] opacity-70 flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{slotStaffCount}名</span>
                </div>
                <button
                  onClick={() => openAdd(slot)}
                  className="text-[11px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-white/60 hover:bg-white/90 transition-colors font-medium select-none"
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
                    {grouped[slot].map((pos) => {
                      const matchingPT = positionTypes.find((pt) => pt.name === pos.name);
                      return (
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
                         staffList={staffList}
                         requiredCount={matchingPT?.required_count || 0}
                       />
                      );
                    })}
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
      {/* Staff overview list */}
      <div className="mt-3 border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border-b border-border">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="font-bold text-xs">スタッフ一覧</span>
          <span className="text-[10px] text-muted-foreground">{staffList.length}名</span>
        </div>
        <div className="bg-card divide-y divide-border">
          {staffList.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-3">スタッフが登録されていません</p>
          ) : (
            staffList.map((s) => {
              const slotAssignments = TIME_SLOTS.map((slot) => {
                const pos = positions.filter(
                  (p) => (p.time_slot || "開場前") === slot && (p.staff_names || []).includes(s.name)
                );
                return { slot, positions: pos };
              }).filter((sa) => sa.positions.length > 0);
              return (
                <div key={s.id} className="flex items-start gap-2 px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0 mt-0.5">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium">{s.name}</p>
                      {s.note && <span className="text-[10px] text-muted-foreground">({s.note})</span>}
                    </div>
                    {slotAssignments.length === 0 ? (
                      <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" />全スロット未配置</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {slotAssignments.map(({ slot, positions: ps }) =>
                          ps.map((p) => {
                            const style = TIME_SLOT_STYLES[slot];
                            return (
                              <span key={p.id} className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${style.header}`}>
                                {slot}：{p.name}
                              </span>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && (
        <PositionFormModal
          position={editing}
          eventId={eventId}
          defaultTimeSlot={defaultSlot}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
          }}
        />
      )}
    </div>
  );
}
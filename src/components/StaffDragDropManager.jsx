import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertCircle, ClipboardList, Plus, Download, Users, GripVertical, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import PositionCard from "@/components/PositionCard";
import PositionFormModal from "@/components/PositionFormModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { usePDFExport } from "@/hooks/usePDFExport";
import { TIME_SLOTS, TIME_SLOT_STYLES } from "@/lib/constants";
import PresetSelector from "@/components/PresetSelector";

export default function StaffDragDropManager({ eventId }) {
  const queryClient = useQueryClient();
  const { canEdit } = useUserRole();
  const isAdmin = canEdit; // admin or chief

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

  const { data: presets = [] } = useQuery({
    queryKey: ["positionPresets"],
    queryFn: () => base44.entities.PositionPreset.list(),
  });

  const updatePositionMutation = useMutation({
    mutationFn: ({ positionId, data }) => base44.entities.Position.update(positionId, data),
    onMutate: async ({ positionId, data }) => {
      await queryClient.cancelQueries({ queryKey: ["positions", eventId] });
      const previousPositions = queryClient.getQueryData(["positions", eventId]);
      queryClient.setQueryData(["positions", eventId], (old) =>
        old.map((p) => (p.id === positionId ? { ...p, ...data } : p))
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
  const [draggingPosId, setDraggingPosId] = useState(null);
  const [dragOverPosId, setDragOverPosId] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultSlot, setDefaultSlot] = useState("開場中");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(null); // slot name
  const [showBulkAssign, setShowBulkAssign] = useState(null); // slot name

  // 一括削除: スロット内の全ポジションを削除
  const handleBulkDelete = async (slot) => {
    const slotPositions = positions.filter((p) => (p.time_slot || "開場中") === slot);
    await Promise.all(slotPositions.map((p) => base44.entities.Position.delete(p.id)));
    queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    setConfirmBulkDelete(null);
  };

  // 一括スタッフ割り当て: スロット内の全ポジションにスタッフを均等配分
  const handleBulkAssign = (slot, selectedStaffNames) => {
    const slotPositions = grouped[slot];
    if (!slotPositions.length || !selectedStaffNames.length) return;
    // スタッフを均等にポジションへ分配（1ポジションずつ順に割り当て）
    const updates = slotPositions.map((pos) => ({
      positionId: pos.id,
      staff_names: [],
    }));
    selectedStaffNames.forEach((name, idx) => {
      updates[idx % updates.length].staff_names.push(name);
    });
    updates.forEach(({ positionId, staff_names }) => {
      base44.entities.Position.update(positionId, { staff_names });
    });
    queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    setShowBulkAssign(null);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Position.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["positions", eventId] });
      const prev = queryClient.getQueryData(["positions", eventId]);
      queryClient.setQueryData(["positions", eventId], (old) => old.filter((p) => p.id !== id));
      return { previousPositions: prev };
    },
    onError: (err, id, context) => {
      queryClient.setQueryData(["positions", eventId], context.previousPositions);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positions", eventId] }),
  });

  const openAdd = (slot) => { setDefaultSlot(slot); setEditing(null); setShowModal(true); };

  const handleStaffDragStart = (e, staffName) => {
    setDraggedStaff(staffName);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const assignStaffToPosition = useCallback((staffName, positionId) => {
    const position = positions.find((p) => p.id === positionId);
    if (!position) return;
    const currentStaffNames = position.staff_names || [];
    if (currentStaffNames.includes(staffName)) return;
    const slot = position.time_slot || "開場中";
    const alreadyInSlot = positions.some(
      (p) => p.id !== positionId && (p.time_slot || "開場中") === slot && (p.staff_names || []).includes(staffName)
    );
    if (alreadyInSlot) return;
    updatePositionMutation.mutate({ positionId, data: { staff_names: [...currentStaffNames, staffName] } });
  }, [positions, updatePositionMutation]);

  const handleDropOnPosition = (e, positionId) => {
    e.preventDefault();
    if (!draggedStaff) return;
    assignStaffToPosition(draggedStaff, positionId);
    setDraggedStaff(null);
  };

  const handleDropUnassigned = (e) => { e.preventDefault(); setDraggedStaff(null); };

  const removeStaffFromPosition = (positionId, staffName) => {
    const position = positions.find((p) => p.id === positionId);
    if (!position) return;
    updatePositionMutation.mutate({
      positionId,
      data: { staff_names: (position.staff_names || []).filter((n) => n !== staffName) },
    });
  };

  // Position reorder - also sync to active preset
  const syncOrderToPreset = (slot, reorderedPositions) => {
    if (!event?.active_preset_id) return;
    const activePreset = presets.find((p) => p.id === event.active_preset_id);
    if (!activePreset) return;
    const currentSlotPositions = activePreset.slot_positions || {};
    // Map position names to positionType ids in new order
    const { data: positionTypes } = queryClient.getQueryState(["positionTypes"]) || {};
    if (!positionTypes) return;
    const newSlotIds = reorderedPositions.map((pos) => {
      const pt = positionTypes.find((t) => t.name === pos.name);
      return pt?.id;
    }).filter(Boolean);
    if (newSlotIds.length > 0) {
      base44.entities.PositionPreset.update(event.active_preset_id, {
        slot_positions: { ...currentSlotPositions, [slot]: newSlotIds },
      });
      queryClient.setQueryData(["positionPresets"], (old) =>
        (old || []).map((p) =>
          p.id === event.active_preset_id
            ? { ...p, slot_positions: { ...(p.slot_positions || {}), [slot]: newSlotIds } }
            : p
        )
      );
    }
  };

  const handlePosDragStart = (e, posId) => { setDraggingPosId(posId); e.dataTransfer.effectAllowed = "move"; };
  const handlePosDragOver = (e, posId) => { e.preventDefault(); if (posId !== draggingPosId) setDragOverPosId(posId); };
  const handlePosDrop = (e, slot, targetPosId) => {
    e.preventDefault();
    if (!draggingPosId || draggingPosId === targetPosId) { setDraggingPosId(null); setDragOverPosId(null); return; }
    const slotPositions = positions.filter((p) => (p.time_slot || "開場中") === slot)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const fromIdx = slotPositions.findIndex((p) => p.id === draggingPosId);
    const toIdx = slotPositions.findIndex((p) => p.id === targetPosId);
    if (fromIdx === -1 || toIdx === -1) { setDraggingPosId(null); setDragOverPosId(null); return; }
    const reordered = [...slotPositions];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    reordered.forEach((pos, idx) => { base44.entities.Position.update(pos.id, { order: idx }); });
    queryClient.setQueryData(["positions", eventId], (old) => {
      const others = old.filter((p) => (p.time_slot || "開場中") !== slot);
      return [...others, ...reordered.map((pos, idx) => ({ ...pos, order: idx }))];
    });
    syncOrderToPreset(slot, reordered);
    setDraggingPosId(null); setDragOverPosId(null);
  };

  const grouped = TIME_SLOTS.reduce((acc, slot) => {
    acc[slot] = positions.filter((p) => (p.time_slot || "開場中") === slot)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return acc;
  }, {});

  const unassigned = staffList.filter((s) => {
    const slotsWithAssignment = TIME_SLOTS.filter((slot) =>
      positions.some((p) => (p.time_slot || "開場中") === slot && (p.staff_names || []).includes(s.name))
    );
    return slotsWithAssignment.length < TIME_SLOTS.length;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-primary" />配置表</h2>
          <p className="text-[11px] text-muted-foreground">スタッフそれぞれの配置管理が可能です。</p>
          {positions.length > 0 && (() => {
            const totalAssigned = [...new Set(positions.flatMap((p) => p.staff_names || []))].length;
            return <div className="text-sm font-medium text-foreground mt-0.5">全時間帯合計：{totalAssigned}名配置済み</div>;
          })()}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PresetSelector eventId={eventId} compact />
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs px-2" onClick={handleExportPDF} disabled={exportingPDF || positions.length === 0}>
            <Download className="w-3 h-3" />{exportingPDF ? '...' : 'PDF'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {TIME_SLOTS.map((slot) => {
          const style = TIME_SLOT_STYLES[slot];
          const slotPositions = grouped[slot];
          const slotStaffCount = [...new Set(slotPositions.flatMap((p) => p.staff_names || []))].length;
          const slotBorderClass = slot === "開場中" ? "border-amber-400 dark:border-amber-500" : slot === "開演中" ? "border-blue-400 dark:border-blue-500" : "border-slate-400 dark:border-slate-400";
          return (
            <div key={slot} className={`border-2 rounded-xl overflow-hidden ${slotBorderClass}`}>
              <div className={`flex items-center justify-between px-2.5 py-1.5 ${style.header}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs">{slot}</span>
                  <span className="text-[10px] opacity-70">{slotPositions.length}件</span>
                  <span className="text-[10px] opacity-70 flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{slotStaffCount}名</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowBulkAssign(slot)}
                      title="一括スタッフ割り当て"
                      className="text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/60 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 text-current transition-colors font-medium select-none">
                      <UserCheck className="w-2.5 h-2.5" />一括登録
                    </button>
                    <button onClick={() => openAdd(slot)}
                      title="ポジションを追加"
                      className="text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/60 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 text-current transition-colors font-medium select-none">
                      <Plus className="w-2.5 h-2.5" />追加
                    </button>
                    {slotPositions.length > 0 && (
                      <button onClick={() => setConfirmBulkDelete(slot)}
                        title="このスロットを一括削除"
                        className="text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-800 dark:text-red-200 transition-colors font-medium select-none">
                        <Trash2 className="w-2.5 h-2.5" />一括削除
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-card p-1.5">
                {slotPositions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-1.5">ポジションがありません</p>
                ) : (
                  <div className="grid gap-1">
                    {slotPositions.map((pos) => (
                      <div key={pos.id}
                        data-pos-id={pos.id}
                        className={`flex items-start gap-1 ${draggingPosId === pos.id ? "opacity-40" : ""} ${dragOverPosId === pos.id ? "ring-2 ring-primary rounded-lg" : ""}`}
                        onDragOver={(e) => handlePosDragOver(e, pos.id)}
                        onDrop={(e) => handlePosDrop(e, slot, pos.id)}
                      >
                        {isAdmin && (
                          <div draggable
                            onDragStart={(e) => handlePosDragStart(e, pos.id)}
                            onDragEnd={() => { setDraggingPosId(null); setDragOverPosId(null); }}
                            className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 shrink-0">
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <PositionCard
                            pos={pos}
                            isAdmin={isAdmin}
                            draggable={true}
                            draggedStaff={draggedStaff}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDropOnPosition(e, pos.id)}
                            onStaffDragStart={(e, name, posId) => {
                              handleStaffDragStart(e, name);
                              removeStaffFromPosition(posId, name);
                            }}
                            onStaffRemove={removeStaffFromPosition}
                            onEdit={(p) => { setEditing(p); setShowModal(true); }}
                            onDelete={(id) => setConfirmDelete({ id, name: pos.name })}
                            emptyLabel="スタッフをドラッグして配置"
                            staffList={staffList}
                            requiredCount={pos.required_count ?? 0}
                            onRequiredCountChange={(v) => {
                              queryClient.setQueryData(["positions", eventId], (old) =>
                                old.map((p) => p.id === pos.id ? { ...p, required_count: v } : p)
                              );
                              base44.entities.Position.update(pos.id, { required_count: v });
                            }}
                            occupiedInSlot={[...new Set(
                              slotPositions.filter((p) => p.id !== pos.id).flatMap((p) => p.staff_names || [])
                            )]}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="mt-1.5 border border-amber-300 dark:border-amber-700 rounded-xl overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-3 h-3" />
            <span className="font-bold text-xs">未配置スタッフ</span>
            <span className="text-[10px] opacity-70">{unassigned.length}名</span>
          </div>
          <div className="bg-card p-1.5 grid gap-1 min-h-[32px]" onDragOver={isAdmin ? handleDragOver : undefined} onDrop={isAdmin ? handleDropUnassigned : undefined}>
            {unassigned.map((s) => (
              <div key={s.id} draggable={isAdmin}
                onDragStart={isAdmin ? (e) => handleStaffDragStart(e, s.name) : undefined}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 ${isAdmin ? "cursor-move hover:bg-amber-100 dark:hover:bg-amber-900/50" : "cursor-default"} ${draggedStaff === s.name ? "opacity-50" : ""}`}>
                <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-[10px] shrink-0">
                  {s.name.charAt(0)}
                </div>
                <span className="text-xs font-medium text-foreground">{s.name}</span>
                {s.note && <span className="text-[10px] text-muted-foreground">({s.note})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted border-b border-border">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="font-bold text-xs">スタッフ一覧</span>
          <span className="text-[10px] text-muted-foreground">{staffList.length}名</span>
        </div>
        <div className="bg-card divide-y divide-border">
          {staffList.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-3">スタッフが登録されていません</p>
          ) : (
            staffList.map((s) => {
              const slotAssignments = TIME_SLOTS.map((slot) => ({
                slot,
                positions: positions.filter((p) => (p.time_slot || "開場中") === slot && (p.staff_names || []).includes(s.name)),
              })).filter((sa) => sa.positions.length > 0);
              return (
                <div key={s.id} className="flex items-start gap-2 px-2.5 py-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0 mt-0.5">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium">{s.name}</p>
                      {s.note && <span className="text-[10px] text-muted-foreground">({s.note})</span>}
                    </div>
                    {slotAssignments.length === 0 ? (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" />全スロット未配置</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {slotAssignments.map(({ slot, positions: ps }) =>
                          ps.map((p) => (
                            <span key={p.id} className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${TIME_SLOT_STYLES[slot].header}`}>
                              {slot}：{p.name}
                            </span>
                          ))
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
        <PositionFormModal position={editing} eventId={eventId} defaultTimeSlot={defaultSlot}
          onClose={() => setShowModal(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ["positions", eventId] }); }} />
      )}
      {confirmDelete && (
        <ConfirmDialog message={`「${confirmDelete.name}」を削除しますか？`} confirmLabel="削除"
          onConfirm={() => { deleteMutation.mutate(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)} />
      )}
      {confirmBulkDelete && (
        <ConfirmDialog
          message={`「${confirmBulkDelete}」のポジションを全て削除しますか？\n（${grouped[confirmBulkDelete]?.length}件のポジションが削除されます）`}
          confirmLabel="一括削除"
          onConfirm={() => handleBulkDelete(confirmBulkDelete)}
          onCancel={() => setConfirmBulkDelete(null)}
        />
      )}
      {showBulkAssign && (
        <BulkAssignModal
          slot={showBulkAssign}
          staffList={staffList}
          slotPositions={grouped[showBulkAssign] || []}
          onAssign={handleBulkAssign}
          onClose={() => setShowBulkAssign(null)}
        />
      )}
    </div>
  );
}

function BulkAssignModal({ slot, staffList, slotPositions, onAssign, onClose }) {
  const [selected, setSelected] = useState([]);

  const toggle = (name) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSubmit = () => {
    onAssign(slot, selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">「{slot}」一括スタッフ登録</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            ✕
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          選択したスタッフを{slotPositions.length}件のポジションに均等に割り当てます。
          既存の配置は上書きされます。
        </p>
        <div className="flex gap-2 mb-2">
          <button onClick={() => setSelected(staffList.map((s) => s.name))}
            className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80">全選択</button>
          <button onClick={() => setSelected([])}
            className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/80">全解除</button>
        </div>
        <div className="border border-border rounded-xl overflow-hidden max-h-52 overflow-y-auto mb-4">
          {staffList.map((s) => {
            const isSelected = selected.includes(s.name);
            return (
              <button key={s.id} onClick={() => toggle(s.name)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left border-b border-border/50 last:border-b-0 transition-colors ${isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"}`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                  {isSelected && <span className="text-[8px] text-primary-foreground font-bold">✓</span>}
                </div>
                {s.name}
                {s.note && <span className="text-xs text-muted-foreground ml-auto">({s.note})</span>}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <p className="text-xs text-muted-foreground mb-3">{selected.length}名選択中</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>キャンセル</Button>
          <Button className="flex-1" disabled={selected.length === 0} onClick={handleSubmit}>
            一括登録
          </Button>
        </div>
      </div>
    </div>
  );
}
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertCircle, ClipboardList, Plus, Download, Users, GripVertical } from "lucide-react";
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
  const isAdmin = canEdit;

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }),
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

  // Touch drag state
  const touchDragStaffRef = useRef(null); // staff name being touch-dragged
  const touchDragPosRef = useRef(null);   // position id being touch-reordered
  const touchGhostRef = useRef(null);     // ghost element
  const touchOverPosIdRef = useRef(null); // current hovered position id

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultSlot, setDefaultSlot] = useState("開場中");
  const [confirmDelete, setConfirmDelete] = useState(null);

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

  // ---- Touch drag helpers ----
  const createGhost = (label) => {
    const el = document.createElement("div");
    el.textContent = label;
    el.style.cssText = "position:fixed;top:-100px;left:-100px;z-index:9999;padding:4px 10px;border-radius:8px;background:#3b4fc8;color:#fff;font-size:12px;font-weight:600;pointer-events:none;box-shadow:0 4px 12px rgba(0,0,0,.25);white-space:nowrap;";
    document.body.appendChild(el);
    return el;
  };

  const moveGhost = (ghost, clientX, clientY) => {
    ghost.style.top = `${clientY - 20}px`;
    ghost.style.left = `${clientX - 40}px`;
  };

  const getPosIdFromPoint = (clientX, clientY) => {
    const els = document.elementsFromPoint(clientX, clientY);
    for (const el of els) {
      const posId = el.closest("[data-pos-id]")?.getAttribute("data-pos-id");
      if (posId) return posId;
    }
    return null;
  };

  // Touch drag for staff chips
  const handleStaffTouchStart = (e, staffName, fromPosId) => {
    const touch = e.touches[0];
    touchDragStaffRef.current = { staffName, fromPosId };
    const ghost = createGhost(staffName);
    moveGhost(ghost, touch.clientX, touch.clientY);
    touchGhostRef.current = ghost;
    if (fromPosId) removeStaffFromPosition(fromPosId, staffName);
    setDraggedStaff(staffName);
  };

  const handleStaffTouchMove = (e) => {
    if (!touchDragStaffRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touchGhostRef.current) moveGhost(touchGhostRef.current, touch.clientX, touch.clientY);
    const posId = getPosIdFromPoint(touch.clientX, touch.clientY);
    touchOverPosIdRef.current = posId;
    setDragOverPosId(posId || null);
  };

  const handleStaffTouchEnd = (e) => {
    if (!touchDragStaffRef.current) return;
    const touch = e.changedTouches[0];
    if (touchGhostRef.current) { document.body.removeChild(touchGhostRef.current); touchGhostRef.current = null; }
    const posId = getPosIdFromPoint(touch.clientX, touch.clientY);
    if (posId) {
      assignStaffToPosition(touchDragStaffRef.current.staffName, posId);
    }
    touchDragStaffRef.current = null;
    touchOverPosIdRef.current = null;
    setDraggedStaff(null);
    setDragOverPosId(null);
  };

  // Touch drag for position reordering
  const handlePosTouchStart = (e, posId) => {
    const touch = e.touches[0];
    touchDragPosRef.current = posId;
    const ghost = createGhost("↕ 移動中");
    moveGhost(ghost, touch.clientX, touch.clientY);
    touchGhostRef.current = ghost;
    setDraggingPosId(posId);
  };

  const handlePosTouchMove = (e) => {
    if (!touchDragPosRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touchGhostRef.current) moveGhost(touchGhostRef.current, touch.clientX, touch.clientY);
    const posId = getPosIdFromPoint(touch.clientX, touch.clientY);
    if (posId && posId !== touchDragPosRef.current) setDragOverPosId(posId);
  };

  const handlePosTouchEnd = (e, slot) => {
    if (!touchDragPosRef.current) return;
    if (touchGhostRef.current) { document.body.removeChild(touchGhostRef.current); touchGhostRef.current = null; }
    const touch = e.changedTouches[0];
    const targetPosId = getPosIdFromPoint(touch.clientX, touch.clientY);
    if (targetPosId && targetPosId !== touchDragPosRef.current) {
      const slotPositions = positions.filter((p) => (p.time_slot || "開場中") === slot)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const fromIdx = slotPositions.findIndex((p) => p.id === touchDragPosRef.current);
      const toIdx = slotPositions.findIndex((p) => p.id === targetPosId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const reordered = [...slotPositions];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        reordered.forEach((pos, idx) => { base44.entities.Position.update(pos.id, { order: idx }); });
        queryClient.setQueryData(["positions", eventId], (old) => {
          const others = old.filter((p) => (p.time_slot || "開場中") !== slot);
          return [...others, ...reordered.map((pos, idx) => ({ ...pos, order: idx }))];
        });
      }
    }
    touchDragPosRef.current = null;
    setDraggingPosId(null);
    setDragOverPosId(null);
  };

  const removeStaffFromPosition = (positionId, staffName) => {
    const position = positions.find((p) => p.id === positionId);
    if (!position) return;
    updatePositionMutation.mutate({
      positionId,
      data: { staff_names: (position.staff_names || []).filter((n) => n !== staffName) },
    });
  };

  // Position reorder
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
      <div className="flex flex-col gap-1.5 mb-3">
        <div className="flex-1">
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-0.5"><ClipboardList className="w-4 h-4 text-primary" />配置表</h2>
          <p className="text-[11px] text-muted-foreground">スタッフそれぞれの配置管理が可能です。</p>
        </div>
        {positions.length > 0 && (() => {
          const totalAssigned = [...new Set(positions.flatMap((p) => p.staff_names || []))].length;
          return <div className="text-sm font-medium text-foreground">全時間帯合計：{totalAssigned}名配置済み</div>;
        })()}
        <PresetSelector eventId={eventId} />
        <Button size="sm" variant="outline" className="gap-1 h-9 text-sm w-full" onClick={handleExportPDF} disabled={exportingPDF || positions.length === 0}>
          <Download className="w-3.5 h-3.5" />{exportingPDF ? 'エクスポート中...' : 'PDF出力'}
        </Button>
      </div>

      <div className="space-y-1.5">
        {TIME_SLOTS.map((slot) => {
          const style = TIME_SLOT_STYLES[slot];
          const slotPositions = grouped[slot];
          const slotStaffCount = [...new Set(slotPositions.flatMap((p) => p.staff_names || []))].length;
          return (
            <div key={slot} className={`border rounded-xl overflow-hidden ${style.header.split(" ").slice(0, 2).join(" ")}`}>
              <div className={`flex items-center justify-between px-2.5 py-1 border-b ${style.header}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs">{slot}</span>
                  <span className="text-[10px] opacity-70">{slotPositions.length}件</span>
                  <span className="text-[10px] opacity-70 flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{slotStaffCount}名</span>
                </div>
                <button onClick={() => openAdd(slot)}
                  className="text-[11px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-white/60 dark:bg-white/10 hover:bg-white/90 dark:hover:bg-white/20 text-current transition-colors font-medium select-none">
                  <Plus className="w-2.5 h-2.5" />追加
                </button>
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
                            onTouchStart={(e) => handlePosTouchStart(e, pos.id)}
                            onTouchMove={handlePosTouchMove}
                            onTouchEnd={(e) => handlePosTouchEnd(e, slot)}
                            className="mt-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 shrink-0 touch-none">
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
                            onStaffTouchStart={handleStaffTouchStart}
                            onStaffTouchMove={handleStaffTouchMove}
                            onStaffTouchEnd={handleStaffTouchEnd}
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
          <div className="bg-card p-1.5 grid gap-1 min-h-[32px]" onDragOver={handleDragOver} onDrop={handleDropUnassigned}>
            {unassigned.map((s) => (
              <div key={s.id} draggable={true}
                onDragStart={(e) => handleStaffDragStart(e, s.name)}
                onTouchStart={(e) => handleStaffTouchStart(e, s.name, null)}
                onTouchMove={handleStaffTouchMove}
                onTouchEnd={handleStaffTouchEnd}
                className={`flex items-center gap-2 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 cursor-move hover:bg-amber-100 dark:hover:bg-amber-900/50 touch-none ${draggedStaff === s.name ? "opacity-50" : ""}`}>
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
    </div>
  );
}
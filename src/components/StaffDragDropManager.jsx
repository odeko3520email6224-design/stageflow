import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertCircle, ClipboardList, Plus, Download, Users, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PositionCard from "@/components/PositionCard";
import PositionBulkAddModal from "@/components/PositionBulkAddModal";
import PositionFormModal from "@/components/PositionFormModal";
import StaffEditModal from "@/components/StaffEditModal";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { usePDFExport } from "@/hooks/usePDFExport";
import { TIME_SLOTS, TIME_SLOT_STYLES } from "@/lib/constants";
import { getStaffDisplayName } from "@/lib/staffName";
import { unwrapFunctionResponse } from "@/lib/base44Response";
import { loadEventById } from "@/lib/eventLoader";
import { LIVE_SYNC_INTERVAL } from "@/lib/liveSync";
import {
  applyPositionSideMutation,
  applyPositionSideSettingsToPositions,
  applyPositionSideSettingsToTypes,
  loadPositionSideSettings,
  rememberPositionSideSettings,
} from "@/lib/positionSideSettings";
import PresetSelector from "@/components/PresetSelector";
import { HiddenInEditMode, ModeLoadingPlaceholder, ModeVisibilityControls, useResolvedEventMode } from "@/components/ModeVisibilityControls";

export default function StaffDragDropManager({ eventId }) {
  const queryClient = useQueryClient();
  const { canEdit, canManageSettings, role } = useUserRole();

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getStaffList", { eventId });
      return res?.data?.staff ?? [];
    },
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const { data: rawPositions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getPositionList", { eventId });
      return res?.data?.positions ?? [];
    },
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => loadEventById(eventId),
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const { data: presets = [] } = useQuery({
    queryKey: ["positionPresets"],
    queryFn: () => base44.entities.PositionPreset.list(),
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const { data: rawPositionTypes = [] } = useQuery({
    queryKey: ["positionTypes"],
    queryFn: () => base44.entities.PositionType.list(),
    select: (d) => [...d].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const { data: sideSettings } = useQuery({
    queryKey: ["positionSideSettings", eventId],
    queryFn: () => loadPositionSideSettings(base44, eventId),
    staleTime: 30_000,
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const positionTypes = applyPositionSideSettingsToTypes(rawPositionTypes, sideSettings);
  const positions = applyPositionSideSettingsToPositions(rawPositions, positionTypes, sideSettings);

  const updatePositionMutation = useMutation({
    scope: { id: `position-side-${eventId}` },
    mutationFn: async ({ positionId, data }) => {
      if (
        Object.prototype.hasOwnProperty.call(data, "staff_names") ||
        Object.prototype.hasOwnProperty.call(data, "staff_names_kamite") ||
        Object.prototype.hasOwnProperty.call(data, "staff_names_shimote") ||
        Object.prototype.hasOwnProperty.call(data, "split_by_side")
      ) {
        const response = await base44.functions.invoke("updatePositionSide", {
          action: "updatePositionStaff",
          eventId,
          positionId,
          ...data,
        });
        const payload = unwrapFunctionResponse(response);
        if (payload?.error) throw new Error(payload.error);
        return payload;
      }
      return base44.entities.Position.update(positionId, data);
    },
    onMutate: async ({ positionId, data }) => {
      await queryClient.cancelQueries({ queryKey: ["positions", eventId] });
      await queryClient.cancelQueries({ queryKey: ["positionSideSettings", eventId] });
      const previousPositions = queryClient.getQueryData(["positions", eventId]);
      const previousSideSettings = queryClient.getQueryData(["positionSideSettings", eventId]);
      queryClient.setQueryData(["positions", eventId], (old) =>
        (old || []).map((p) => (p.id === positionId ? { ...p, ...data } : p))
      );
      if (
        Object.prototype.hasOwnProperty.call(data, "staff_names_kamite") ||
        Object.prototype.hasOwnProperty.call(data, "staff_names_shimote") ||
        Object.prototype.hasOwnProperty.call(data, "split_by_side")
      ) {
        queryClient.setQueryData(["positionSideSettings", eventId], (old) =>
          applyPositionSideMutation(old, positionId, data)
        );
      }
      return { previousPositions, previousSideSettings };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(["positions", eventId], context?.previousPositions);
      queryClient.setQueryData(["positionSideSettings", eventId], context?.previousSideSettings);
    },
    onSuccess: (result) => {
      if (result?.sideSettings) {
        queryClient.setQueryData(["positionSideSettings", eventId], rememberPositionSideSettings(eventId, result.sideSettings));
      }
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    },
  });

  const { exporting: exportingPDF, exportPDF: handleExportPDF } = usePDFExport(eventId, "staff", "配置表");

  const [draggedStaff, setDraggedStaff] = useState(null);
  const [draggingPosId, setDraggingPosId] = useState(null);
  const [dragOverPosId, setDragOverPosId] = useState(null);
  const autoScrollFrameRef = useRef(null);
  const dragPointRef = useRef(null);
  const autoScrollActiveRef = useRef(false);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [defaultSlot, setDefaultSlot] = useState("開場中");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(null); // slot name

  const stopAutoScroll = useCallback(() => {
    autoScrollActiveRef.current = false;
    dragPointRef.current = null;
    if (autoScrollFrameRef.current) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    const isDragging = Boolean(draggedStaff || draggingPosId);
    if (!canEdit || !isDragging) {
      stopAutoScroll();
      return undefined;
    }

    autoScrollActiveRef.current = true;
    const edgeSize = 96;
    const maxSpeed = 24;

    const getVelocity = (point, size) => {
      if (point < edgeSize) return -Math.ceil(((edgeSize - point) / edgeSize) * maxSpeed);
      if (point > size - edgeSize) return Math.ceil(((point - (size - edgeSize)) / edgeSize) * maxSpeed);
      return 0;
    };

    const step = () => {
      autoScrollFrameRef.current = null;
      if (!autoScrollActiveRef.current || !dragPointRef.current) return;

      const { x, y } = dragPointRef.current;
      const top = getVelocity(y, window.innerHeight);
      const left = getVelocity(x, window.innerWidth);
      if (top || left) {
        window.scrollBy({ top, left, behavior: "auto" });
        autoScrollFrameRef.current = requestAnimationFrame(step);
      }
    };

    const handleWindowDragOver = (e) => {
      dragPointRef.current = { x: e.clientX, y: e.clientY };
      if (!autoScrollFrameRef.current) {
        autoScrollFrameRef.current = requestAnimationFrame(step);
      }
    };

    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", stopAutoScroll);
    window.addEventListener("dragend", stopAutoScroll);

    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      window.removeEventListener("drop", stopAutoScroll);
      window.removeEventListener("dragend", stopAutoScroll);
      stopAutoScroll();
    };
  }, [draggedStaff, draggingPosId, canEdit, stopAutoScroll]);

  // 一括削除: スロット内の全ポジションを削除
  const handleBulkDelete = async (slot) => {
    const slotPositions = positions.filter((p) => (p.time_slot || "開場中") === slot);
    await Promise.all(slotPositions.map((p) => base44.entities.Position.delete(p.id)));
    queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    setConfirmBulkDelete(null);
  };

  const getRequiredCountForSlot = (positionType, slot) => {
    if (slot === TIME_SLOTS[0]) return positionType.required_count_before ?? positionType.required_count ?? 0;
    if (slot === TIME_SLOTS[1]) return positionType.required_count_during ?? positionType.required_count ?? 0;
    return positionType.required_count_after ?? positionType.required_count ?? 0;
  };

  const handleBulkCreatePositions = async (slot) => {
    const existingNames = new Set((grouped[slot] || []).map((p) => p.name));
    const targets = positionTypes.filter((pt) => !existingNames.has(pt.name));
    if (targets.length === 0) return;
    const startOrder = grouped[slot]?.length || 0;
    await Promise.all(targets.map((pt, idx) =>
      base44.entities.Position.create({
        event_id: eventId,
        name: pt.name,
        time_slot: slot,
        staff_names: [],
        notes: "",
        color: pt.color || "#6366f1",
        required_count: getRequiredCountForSlot(pt, slot),
        order: startOrder + idx,
      })
    ));
    queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
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

  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const openAdd = (slot) => { setDefaultSlot(slot); setShowBulkAddModal(true); };

  const handleStaffDragStart = (e, staffName) => {
    setDraggedStaff(staffName);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleStaffDragEnd = () => {
    setDraggedStaff(null);
    stopAutoScroll();
  };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const assignStaffToPosition = useCallback((staffName, positionId, side = null) => {
    const position = positions.find((p) => p.id === positionId);
    if (!position) return;
    const effectiveSide = position.split_by_side ? (side || "kamite") : null;
    const currentStaffNames = position.staff_names || [];
    const kamite = position.staff_names_kamite || [];
    const shimote = position.staff_names_shimote || [];
    if (currentStaffNames.includes(staffName) && (!position.split_by_side || !effectiveSide)) return;
    const slot = position.time_slot || "開場中";
    const alreadyInSlot = positions.some(
      (p) => p.id !== positionId && (p.time_slot || "開場中") === slot && (p.staff_names || []).includes(staffName)
    );
    if (alreadyInSlot) return;
    const nextKamite = effectiveSide === "kamite" ? [...new Set([...kamite, staffName])] : kamite.filter((n) => n !== staffName);
    const nextShimote = effectiveSide === "shimote" ? [...new Set([...shimote, staffName])] : shimote.filter((n) => n !== staffName);
    const nextStaffNames = position.split_by_side
      ? [...new Set([...nextKamite, ...nextShimote])]
      : [...new Set([...currentStaffNames, staffName])];
    updatePositionMutation.mutate({
      positionId,
      data: {
        staff_names: nextStaffNames,
        ...(position.split_by_side ? { split_by_side: true, staff_names_kamite: nextKamite, staff_names_shimote: nextShimote } : {}),
      },
    });
  }, [positions, updatePositionMutation]);

  const handleDropOnPosition = (e, positionId) => {
    e.preventDefault();
    if (!draggedStaff) return;
    assignStaffToPosition(draggedStaff, positionId);
    setDraggedStaff(null);
  };

  const handleDropOnPositionSide = (e, positionId, side) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedStaff) return;
    assignStaffToPosition(draggedStaff, positionId, side);
    setDraggedStaff(null);
  };

  const handleDropUnassigned = (e) => { e.preventDefault(); setDraggedStaff(null); };

  const removeStaffFromPosition = (positionId, staffName) => {
    const position = positions.find((p) => p.id === positionId);
    if (!position) return;
    updatePositionMutation.mutate({
      positionId,
      data: {
        staff_names: (position.staff_names || []).filter((n) => n !== staffName),
        split_by_side: Boolean(position.split_by_side),
        staff_names_kamite: (position.staff_names_kamite || []).filter((n) => n !== staffName),
        staff_names_shimote: (position.staff_names_shimote || []).filter((n) => n !== staffName),
      },
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
  const handlePosDragEnd = () => { setDraggingPosId(null); setDragOverPosId(null); stopAutoScroll(); };
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

  const unassigned = staffList
    .map((staff) => {
      const missingSlots = TIME_SLOTS.filter((slot) =>
        !positions.some((p) => (p.time_slot || "開場中") === slot && (p.staff_names || []).includes(staff.name))
      );
      return { ...staff, missingSlots };
    })
    .filter((staff) => staff.missingSlots.length > 0);
  const { mode: assignmentMode, isReady: isModeReady } = useResolvedEventMode(eventId, "assignment_mode", event?.assignment_mode);
  const isEditMode = assignmentMode === "edit";
  const hideForUser = !canEdit && assignmentMode !== "public";
  const isVisibilityReady = Boolean(role) && isModeReady && Boolean(event);
  const isAdmin = canEdit && isEditMode;
  const shouldMaskStaffNames = role !== "admin" && role !== "chief";

  return (
    <div>
      <div className="flex flex-col gap-1.5 mb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-primary" />配置表</h2>
          {positions.length > 0 && (() => {
            const totalAssigned = [...new Set(positions.flatMap((p) => p.staff_names || []))].length;
            return <div className="text-sm font-medium text-foreground mt-0.5">全時間帯合計：{totalAssigned}名配置済み</div>;
          })()}
        </div>
        <div className="flex items-center gap-1.5 justify-end flex-wrap sm:flex-nowrap sm:ml-auto">
          <ModeVisibilityControls
            eventId={eventId}
            field="assignment_mode"
            mode={assignmentMode}
            canManage={canManageSettings}
            label="配置表"
          />
          {canManageSettings && <PresetSelector eventId={eventId} compact />}
          <Button size="sm" variant="outline" className="gap-1 h-8 text-xs px-2 shrink-0" onClick={handleExportPDF} disabled={!isVisibilityReady || hideForUser || exportingPDF || positions.length === 0}>
            <Download className="w-3 h-3" />{exportingPDF ? '...' : 'PDF'}
          </Button>
        </div>
      </div>

      {!isVisibilityReady ? (
        <ModeLoadingPlaceholder />
      ) : hideForUser ? (
        <HiddenInEditMode title="配置表は編集モード中です" />
      ) : (
        <>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {TIME_SLOTS.map((slot) => {
          const style = TIME_SLOT_STYLES[slot];
          const slotPositions = grouped[slot];
          const slotStaffCount = [...new Set(slotPositions.flatMap((p) => p.staff_names || []))].length;
          const slotBorderClass = slot === "開場中" ? "border-amber-400 dark:border-amber-500" : slot === "開演中" ? "border-blue-400 dark:border-blue-500" : "border-slate-400 dark:border-slate-400";
          return (
            <div key={slot} className={`border-2 rounded-lg overflow-hidden ${slotBorderClass}`}>
              <div className={`flex items-center justify-between px-2 py-1 ${style.header}`}>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs">{slot}</span>
                  <span className="text-[10px] opacity-70">{slotPositions.length}件</span>
                  <span className="text-[10px] opacity-70 flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{slotStaffCount}名</span>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleBulkCreatePositions(slot)}
                      disabled
                      title="ポジション種別をこの時間帯に一括登録"
                      className="text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 transition-colors font-medium select-none cursor-not-allowed opacity-50">
                      <Plus className="w-2.5 h-2.5" />一括登録
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
              <div className="bg-card p-1">
                {slotPositions.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground text-center py-1.5">ポジションがありません</p>
                ) : (
                  <div className="grid gap-0.5">
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
                            onDragEnd={handlePosDragEnd}
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
                            onDropSide={(e, side) => handleDropOnPositionSide(e, pos.id, side)}
                            onStaffDragStart={(e, name, posId) => {
                              handleStaffDragStart(e, name);
                              removeStaffFromPosition(posId, name);
                            }}
                            onStaffDragEnd={handleStaffDragEnd}
                            onStaffRemove={removeStaffFromPosition}
                            onStaffEdit={(staff) => setEditingStaff(staff)}
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
                            maskStaffNames={shouldMaskStaffNames}
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
        <div className="mt-1.5 border border-amber-300 dark:border-amber-700 rounded-lg overflow-hidden">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300">
            <AlertCircle className="w-3 h-3" />
            <span className="font-bold text-xs">未配置スタッフ</span>
            <span className="text-[10px] opacity-70">{unassigned.length}名</span>
          </div>
          <div className="bg-card p-1 grid gap-1 min-h-[28px] sm:grid-cols-3" onDragOver={isAdmin ? handleDragOver : undefined} onDrop={isAdmin ? handleDropUnassigned : undefined}>
            {unassigned.map((s) => {
              const displayName = getStaffDisplayName(s.name, shouldMaskStaffNames);
              return (
              <div key={s.id} draggable={isAdmin}
                onDragStart={isAdmin ? (e) => handleStaffDragStart(e, s.name) : undefined}
                onDragEnd={isAdmin ? handleStaffDragEnd : undefined}
                className={`flex items-start gap-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 ${isAdmin ? "cursor-move hover:bg-amber-100 dark:hover:bg-amber-900/50" : "cursor-default"} ${draggedStaff === s.name ? "opacity-50" : ""}`}>
                <div className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-300 font-bold text-[10px] shrink-0 mt-0.5">
                  {displayName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{displayName}</span>
                    {s.note && <span className="text-[10px] text-muted-foreground truncate">({s.note})</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.missingSlots.map((slot) => (
                      <span key={slot} className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${TIME_SLOT_STYLES[slot].header}`}>
                        {slot}未配置
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-1.5 border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted border-b border-border">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="font-bold text-xs">スタッフ一覧</span>
          <span className="text-[10px] text-muted-foreground">{staffList.length}名</span>
        </div>
        <div className="bg-card sm:grid sm:grid-cols-3 sm:divide-y-0 divide-y divide-border sm:[&>*]:border-b sm:[&>*]:border-border/50">
          {staffList.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-3">スタッフが登録されていません</p>
          ) : (
            staffList.map((s) => {
              const displayName = getStaffDisplayName(s.name, shouldMaskStaffNames);
              const nameColor = s.color || undefined;
              const slotAssignments = TIME_SLOTS.map((slot) => ({
                slot,
                positions: positions.filter((p) => (p.time_slot || "開場中") === slot && (p.staff_names || []).includes(s.name)),
              })).filter((sa) => sa.positions.length > 0);
              return (
                <div key={s.id} className="flex items-start gap-2 px-2 py-1">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0 mt-0.5">
                    {displayName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-medium" style={{ color: nameColor }}>{displayName}</p>
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
                    {isAdmin && (
                      <div className="flex items-center gap-3 mt-0.5">
                        <label className="flex items-center gap-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!s.costume_change}
                            onChange={(e) => {
                              const val = e.target.checked;
                              queryClient.setQueryData(["staff", eventId], (old = []) =>
                                old.map((item) => item.id === s.id ? { ...item, costume_change: val } : item)
                              );
                              base44.functions.invoke("updateStaffRecord", { action: "update", staffId: s.id, data: { costume_change: val } });
                            }}
                            className="w-3 h-3 accent-purple-600"
                          />
                          <span className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">着替</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!s.break}
                            onChange={(e) => {
                              const val = e.target.checked;
                              queryClient.setQueryData(["staff", eventId], (old = []) =>
                                old.map((item) => item.id === s.id ? { ...item, break: val } : item)
                              );
                              base44.functions.invoke("updateStaffRecord", { action: "update", staffId: s.id, data: { break: val } });
                            }}
                            className="w-3 h-3 accent-sky-600"
                          />
                          <span className="text-[11px] text-sky-700 dark:text-sky-300 font-medium">休憩</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showBulkAddModal && (
        <PositionBulkAddModal eventId={eventId} defaultTimeSlot={defaultSlot}
          onClose={() => setShowBulkAddModal(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ["positions", eventId] }); }} />
      )}
      {showModal && (
        <PositionFormModal position={editing} eventId={eventId} defaultTimeSlot={defaultSlot}
          onClose={() => setShowModal(false)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ["positions", eventId] }); }} />
      )}
      {editingStaff && (
        <StaffEditModal
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSaved={() => {}}
        />
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
        </>
      )}
    </div>
  );
}
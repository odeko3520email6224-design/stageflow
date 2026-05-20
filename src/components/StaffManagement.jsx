import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Users, AlertCircle, Pencil, UserCog, Download, ShieldCheck } from "lucide-react";
import StaffScrapeModal from "@/components/StaffScrapeModal";
import StaffEditModal from "@/components/StaffEditModal";
import { TIME_SLOT_STYLES } from "@/lib/constants";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { getStaffDisplayName } from "@/lib/staffName";
import { unwrapFunctionResponse } from "@/lib/base44Response";
import { loadEventById } from "@/lib/eventLoader";
import { HiddenInEditMode, ModeLoadingPlaceholder, ModeVisibilityControls, useResolvedEventMode } from "@/components/ModeVisibilityControls";

export default function StaffManagement({ eventId }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [editingStaff, setEditingStaff] = useState(null);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [localChiefName, setLocalChiefName] = useState("");
  const queryClient = useQueryClient();
  const { canEdit, canManageSettings, role } = useUserRole();
  const shouldMaskStaffNames = role !== "admin" && role !== "chief";


  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId })
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId })
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => loadEventById(eventId),
  });

  useEffect(() => {
    const storageKey = `stageflow:event-chief:${eventId}`;
    const savedChiefName = window.localStorage.getItem(storageKey);
    setLocalChiefName(savedChiefName || event?.chief_staff_name || "");
  }, [eventId, event?.chief_staff_name]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Staff.create(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["staff", eventId] });
      const previousStaff = queryClient.getQueryData(["staff", eventId]);
      const optimisticId = `temp-staff-${Date.now()}`;
      queryClient.setQueryData(["staff", eventId], (old = []) => [...old, { ...data, id: optimisticId }]);
      setName("");
      setNote("");
      return { previousStaff, optimisticId };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["staff", eventId], context?.previousStaff);
      toast.error("スタッフの追加に失敗しました");
    },
    onSuccess: (createdStaff, __, context) => {
      if (createdStaff?.id) {
        queryClient.setQueryData(["staff", eventId], (old = []) =>
          old.map((staff) => staff.id === context?.optimisticId ? createdStaff : staff)
        );
      }
      queryClient.invalidateQueries({ queryKey: ["staff", eventId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const staffToDelete = staffList.find((s) => s.id === id);
      await base44.entities.Staff.delete(id);
      if (staffToDelete) {
        const affected = positions.filter((p) => (p.staff_names || []).includes(staffToDelete.name));
        await Promise.all(
          affected.map((p) =>
          base44.entities.Position.update(p.id, {
            staff_names: p.staff_names.filter((n) => n !== staffToDelete.name)
          })
          )
        );
      }
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["staff", eventId] });
      await queryClient.cancelQueries({ queryKey: ["positions", eventId] });
      const previousStaff = queryClient.getQueryData(["staff", eventId]);
      const previousPositions = queryClient.getQueryData(["positions", eventId]);
      const staffToDelete = staffList.find((s) => s.id === id);
      queryClient.setQueryData(["staff", eventId], (old = []) => old.filter((staff) => staff.id !== id));
      if (staffToDelete) {
        queryClient.setQueryData(["positions", eventId], (old = []) =>
          old.map((position) => ({
            ...position,
            staff_names: (position.staff_names || []).filter((name) => name !== staffToDelete.name),
          }))
        );
      }
      return { previousStaff, previousPositions };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["staff", eventId], context?.previousStaff);
      queryClient.setQueryData(["positions", eventId], context?.previousPositions);
      toast.error("スタッフの削除に失敗しました");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", eventId] });
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    }
  });

  const updateChiefMutation = useMutation({
    mutationFn: async (chief_staff_name) => {
      const response = await base44.functions.invoke("updateEventChief", {
        eventId: event?.id || eventId,
        chief_staff_name,
      });
      const payload = unwrapFunctionResponse(response);
      if (payload?.error) throw new Error(payload.error);
      return payload?.event;
    },
    onMutate: async (chief_staff_name) => {
      await queryClient.cancelQueries({ queryKey: ["event", eventId] });
      const previousEvent = queryClient.getQueryData(["event", eventId]);
      const previousLocalChiefName = localChiefName;
      setLocalChiefName(chief_staff_name);
      window.localStorage.setItem(`stageflow:event-chief:${eventId}`, chief_staff_name);
      queryClient.setQueryData(["event", eventId], (old) => {
        if (Array.isArray(old)) {
          return old.map((item) => item.id === (event?.id || eventId) ? { ...item, chief_staff_name } : item);
        }
        return old ? { ...old, chief_staff_name } : old;
      });
      return { previousEvent, previousLocalChiefName };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["event", eventId], context?.previousEvent);
      setLocalChiefName(context?.previousLocalChiefName || "");
      window.localStorage.setItem(`stageflow:event-chief:${eventId}`, context?.previousLocalChiefName || "");
      toast.error("チーフの保存に失敗しました");
    },
    onSuccess: (updatedEvent, chief_staff_name) => {
      const savedChiefName = updatedEvent?.chief_staff_name ?? chief_staff_name;
      setLocalChiefName(savedChiefName);
      window.localStorage.setItem(`stageflow:event-chief:${eventId}`, savedChiefName);
      queryClient.setQueryData(["event", eventId], (old) => {
        if (Array.isArray(old)) {
          return old.map((item) => item.id === (event?.id || eventId) ? { ...item, chief_staff_name: savedChiefName } : item);
        }
        return old ? { ...old, chief_staff_name: savedChiefName } : old;
      });
      toast.success("チーフを保存しました");
    },
  });

  const handleAdd = () => {
    if (!canUseEditTools || !name.trim()) return;
    createMutation.mutate({ event_id: eventId, name: name.trim(), note: note.trim() });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {e.preventDefault();handleAdd();}
  };

  // Build map: staffName -> assigned positions (sorted by slot order)
  const SLOT_ORDER = ["開場中", "開演中", "終演後"];
  const assignedMap = {};
  positions.forEach((pos) => {
    (pos.staff_names || []).forEach((sName) => {
      if (!assignedMap[sName]) assignedMap[sName] = [];
      assignedMap[sName].push({ posName: pos.name || pos.role, slot: pos.time_slot || "開場中" });
    });
  });
  // Sort each staff's assignments by slot order
  Object.keys(assignedMap).forEach((name) => {
    assignedMap[name].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
  });

  const { mode: staffManagementMode, isReady: isModeReady } = useResolvedEventMode(eventId, "staff_management_mode", event?.staff_management_mode);
  const isEditMode = staffManagementMode === "edit";
  const hideForUser = !canEdit && staffManagementMode !== "public";
  const isVisibilityReady = Boolean(role) && isModeReady && Boolean(event);
  const canUseEditTools = canEdit && isEditMode;

  return (
    <div>
      <div className="flex flex-col gap-1.5 mb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold flex items-center gap-1.5"><UserCog className="w-4 h-4 text-primary" />スタッフ管理</h2>
          {isVisibilityReady && !hideForUser && (
            <div className="text-xs font-medium text-foreground mt-0.5">登録スタッフ数：{staffList.length}名</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 justify-end flex-wrap sm:flex-nowrap sm:ml-auto">
          <ModeVisibilityControls
            eventId={eventId}
            field="staff_management_mode"
            mode={staffManagementMode}
            canManage={canManageSettings}
            label="スタッフ管理"
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1 h-8 text-xs px-2 shrink-0"
            onClick={() => canUseEditTools && setShowScrapeModal(true)}
            disabled={!canUseEditTools}
          >
            <Download className="w-3 h-3" />A-CAST取得
          </Button>
        </div>
      </div>

      {!isVisibilityReady ? (
        <ModeLoadingPlaceholder />
      ) : hideForUser ? (
        <HiddenInEditMode title="スタッフ管理は編集モード中です" />
      ) : (
        <>

      {/* Add form */}
      <div className="bg-card border border-border rounded-lg p-1 mb-1.5">
        <div className="flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="スタッフ名"
            disabled={!canUseEditTools}
            className="flex-1 h-8 text-sm" />
          
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備考"
            disabled={!canUseEditTools}
            className="w-24 h-8 text-sm" />
          
          <Button onClick={handleAdd} disabled={!canUseEditTools || !name.trim() || createMutation.isPending} size="sm" className="gap-0.5 h-8 px-2 shrink-0">
            <Plus className="w-3 h-3" />追加
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg px-2 py-1.5 mb-1.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            <h3 className="text-xs font-bold">チーフ・システム管理者</h3>
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[10px] font-medium text-muted-foreground shrink-0">チーフ</span>
            <select
              value={localChiefName}
              onChange={(e) => updateChiefMutation.mutate(e.target.value)}
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!canUseEditTools || staffList.length === 0 || updateChiefMutation.isPending}
            >
              <option value="">未選択</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.name}>{getStaffDisplayName(staff.name, shouldMaskStaffNames)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-xs">
            <span className="text-[10px] font-medium text-muted-foreground">システム管理者</span>
            <span className="font-medium">髙岡 永輝</span>
          </div>
        </div>
        <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] font-medium text-destructive">
          バグ・不具合の緊急対応はシステム管理者までご報告ください
        </p>
      </div>

      {/* Staff list */}
      {isLoading ?
      <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div> :
      staffList.length === 0 ?
      <div className="text-center py-14 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">スタッフが登録されていません</p>
        </div> :

      <div className="space-y-1">
          {staffList.map((staff) => {
          const assigned = assignedMap[staff.name] || [];
          const displayName = getStaffDisplayName(staff.name, shouldMaskStaffNames);
          const unassigned = assigned.length === 0;
          return (
            <div key={staff.id} className={`bg-card border rounded-md px-2 py-0.5 ${unassigned ? "border-amber-300" : "border-border"}`}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                    {displayName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-xs">{displayName}</p>
                      {staff.note && <span className="text-[10px] text-muted-foreground">({staff.note})</span>}
                      {unassigned &&
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded-full dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
                          <AlertCircle className="w-2 h-2" />未配置
                        </span>
                    }
                    </div>
                  </div>
                  <button
                  onClick={() => canUseEditTools && setEditingStaff(staff)}
                  disabled={!canUseEditTools}
                  className="p-1 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:pointer-events-none"
                  title="編集">
                  
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                  onClick={() => canUseEditTools && setConfirmDelete({ id: staff.id, name: staff.name })}
                  disabled={!canUseEditTools}
                  className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:pointer-events-none"
                  title="削除">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {assigned.length > 0 &&
              <div className="mt-0.5 flex flex-wrap gap-0.5 pl-8">
                    {assigned.map((a, i) =>
                <span key={i} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${TIME_SLOT_STYLES[a.slot]?.badge || "bg-slate-100 border-slate-200 text-slate-700"}`}>
                        {a.slot}：{a.posName}
                      </span>
                )}
                  </div>
              }
              </div>);

        })}
        </div>
      }

      {showScrapeModal &&
      <StaffScrapeModal eventId={eventId} onClose={() => setShowScrapeModal(false)} />
      }

      {editingStaff &&
      <StaffEditModal
        staff={editingStaff}
        onClose={() => setEditingStaff(null)}
        onSaved={() => {}} />
      }

      {confirmDelete && (
        <ConfirmDialog
          message={`「${confirmDelete.name}」を削除しますか？`}
          confirmLabel="削除"
          onConfirm={() => { deleteMutation.mutate(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
        </>
      )}
    </div>);

}

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { fetchPublicEvent, fetchPublicPositions, fetchPublicStaff } from "@/lib/publicData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Users, AlertCircle, Pencil, X, UserCog, Download, ShieldCheck } from "lucide-react";
import StaffScrapeModal from "@/components/StaffScrapeModal";
import { TIME_SLOT_STYLES } from "@/lib/constants";
import ConfirmDialog from "@/components/ConfirmDialog";
import { motion } from "framer-motion";
import { useUserRole } from "@/hooks/useUserRole";

function EditModal({ staff, onClose, onSaved }) {
  const [name, setName] = useState(staff.name);
  const [note, setNote] = useState(staff.note || "");
  const queryClient = useQueryClient();

  const [localName, setLocalName] = useState(staff.name);
  const [localNote, setLocalNote] = useState(staff.note || "");
  const prevDataRef = useRef({ name: staff.name, note: staff.note || "" });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Staff.update(staff.id, data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["staff", staff.event_id] });
      await queryClient.cancelQueries({ queryKey: ["positions", staff.event_id] });
      const previousStaff = queryClient.getQueryData(["staff", staff.event_id]);
      const previousPositions = queryClient.getQueryData(["positions", staff.event_id]);
      queryClient.setQueryData(["staff", staff.event_id], (old = []) =>
        old.map((item) => item.id === staff.id ? { ...item, ...data } : item)
      );
      if (data.name && data.name !== staff.name) {
        queryClient.setQueryData(["positions", staff.event_id], (old = []) =>
          old.map((position) => ({
            ...position,
            staff_names: (position.staff_names || []).map((name) => name === staff.name ? data.name : name),
          }))
        );
      }
      return { previousStaff, previousPositions };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["staff", staff.event_id], context?.previousStaff);
      queryClient.setQueryData(["positions", staff.event_id], context?.previousPositions);
      toast.error("保存に失敗しました");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", staff.event_id] });
      queryClient.invalidateQueries({ queryKey: ["positions", staff.event_id] });
      onSaved();
    }
  });

  // Auto-save: text fields → 500ms
  useEffect(() => {
    if (!localName.trim()) return;
    if (localName === prevDataRef.current.name && localNote === prevDataRef.current.note) return;
    const timer = setTimeout(() => {
      updateMutation.mutate({ name: localName.trim(), note: localNote.trim() }, {
        onSuccess: () => {
          toast.success("保存しました");
          prevDataRef.current = { name: localName, note: localNote };
        }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [localName, localNote]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-2 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm p-5"
        initial={{ y: 32, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">スタッフ編集</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="閉じる">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">スタッフ名</label>
            <Input value={localName} onChange={(e) => setLocalName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">備考</label>
            <Input value={localNote} onChange={(e) => setLocalNote(e.target.value)} placeholder="任意" className="mt-1" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" size="sm" onClick={onClose}>閉じる</Button>
        </div>
      </motion.div>
    </motion.div>);

}

export default function StaffManagement({ eventId }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [editingStaff, setEditingStaff] = useState(null);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const queryClient = useQueryClient();
  const { canEdit } = useUserRole();


  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => fetchPublicStaff(eventId),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => fetchPublicPositions(eventId),
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => fetchPublicEvent(eventId),
  });

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
      if (response.data?.error) throw new Error(response.data.error);
      return response.data?.event;
    },
    onMutate: async (chief_staff_name) => {
      await queryClient.cancelQueries({ queryKey: ["event", eventId] });
      const previousEvent = queryClient.getQueryData(["event", eventId]);
      queryClient.setQueryData(["event", eventId], (old) => {
        if (Array.isArray(old)) {
          return old.map((item) => item.id === (event?.id || eventId) ? { ...item, chief_staff_name } : item);
        }
        return old ? { ...old, chief_staff_name } : old;
      });
      return { previousEvent };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["event", eventId], context?.previousEvent);
      toast.error("チーフの保存に失敗しました");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      toast.success("チーフを保存しました");
    },
  });

  const handleAdd = () => {
    if (!canEdit) return;
    if (!name.trim()) return;
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

  return (
    <div>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-0.5"><UserCog className="w-4 h-4 text-primary" />スタッフ管理</h2>
          <p className="text-[11px] text-muted-foreground">スタッフの追加・編集・削除が可能です。</p>
          <div className="text-xs font-medium text-foreground mt-0.5">登録スタッフ数：{staffList.length}名</div>
        </div>
        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs px-2 shrink-0" onClick={() => setShowScrapeModal(true)} disabled={!canEdit}>
          <Download className="w-3 h-3" />A-CAST取得
        </Button>
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-lg p-1 mb-1.5">
        <div className="flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="スタッフ名"
            className="flex-1 h-8 text-sm" />
          
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備考"
            className="w-24 h-8 text-sm" />
          
          <Button onClick={handleAdd} disabled={!canEdit || !name.trim() || createMutation.isPending} size="sm" className="gap-0.5 h-8 px-2 shrink-0">
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
              value={event?.chief_staff_name || ""}
              onChange={(e) => updateChiefMutation.mutate(e.target.value)}
              className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!canEdit || staffList.length === 0 || updateChiefMutation.isPending}
            >
              <option value="">未選択</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.name}>{staff.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-xs">
            <span className="text-[10px] font-medium text-muted-foreground">システム管理者</span>
            <span className="font-medium">髙岡 永輝</span>
          </div>
        </div>
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
          const unassigned = assigned.length === 0;
          return (
            <div key={staff.id} className={`bg-card border rounded-md px-2 py-0.5 ${unassigned ? "border-amber-300" : "border-border"}`}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                    {staff.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-xs">{staff.name}</p>
                      {staff.note && <span className="text-[10px] text-muted-foreground">({staff.note})</span>}
                      {unassigned &&
                    <span className="flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded-full dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700">
                          <AlertCircle className="w-2 h-2" />未配置
                        </span>
                    }
                    </div>
                  </div>
                  <button
                  onClick={() => setEditingStaff(staff)}
                  disabled={!canEdit}
                  className="p-1 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title="編集">
                  
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                  onClick={() => setConfirmDelete({ id: staff.id, name: staff.name })}
                  disabled={!canEdit}
                  className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
      <EditModal
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
    </div>);

}

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Users, AlertCircle, Pencil, X, Check, UserCog, Download } from "lucide-react";
import StaffScrapeModal from "@/components/StaffScrapeModal";
import { useUserRole } from "@/hooks/useUserRole";

const TIME_SLOT_COLORS = {
  "開場前": "bg-amber-100 text-amber-700 border-amber-200",
  "開演中": "bg-blue-100 text-blue-700 border-blue-200",
  "終演後": "bg-slate-100 text-slate-600 border-slate-200",
};

function EditModal({ staff, onClose, onSaved }) {
  const [name, setName] = useState(staff.name);
  const [note, setNote] = useState(staff.note || "");
  const queryClient = useQueryClient();

  const [localName, setLocalName] = useState(staff.name);
  const [localNote, setLocalNote] = useState(staff.note || "");
  const prevDataRef = useRef({ name: staff.name, note: staff.note || "" });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Staff.update(staff.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", staff.event_id] });
      queryClient.invalidateQueries({ queryKey: ["positions", staff.event_id] });
      onSaved();
    },
  });

  // Auto-save on changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localName !== prevDataRef.current.name || localNote !== prevDataRef.current.note) {
        updateMutation.mutate({ name: localName.trim(), note: localNote.trim() });
        prevDataRef.current = { name: localName, note: localNote };
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [localName, localNote]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">スタッフ編集</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
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
          <Button
            className="flex-1"
            size="sm"
            disabled={!localName.trim() || updateMutation.isPending}
            onClick={() => {
              updateMutation.mutate({ name: localName.trim(), note: localNote.trim() });
              setTimeout(onClose, 500);
            }}
          >
            {updateMutation.isPending ? "保存中..." : "保存済み"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function StaffManagement({ eventId }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [editingStaff, setEditingStaff] = useState(null);
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const queryClient = useQueryClient();


  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Staff.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", eventId] });
      setName("");
      setNote("");
    },
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
              staff_names: p.staff_names.filter((n) => n !== staffToDelete.name),
            })
          )
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", eventId] });
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    },
  });

  const handleAdd = () => {
    if (!name.trim()) return;
    createMutation.mutate({ event_id: eventId, name: name.trim(), note: note.trim() });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAdd(); }
  };

  // Build map: staffName -> assigned positions
  const assignedMap = {};
  positions.forEach((pos) => {
    (pos.staff_names || []).forEach((sName) => {
      if (!assignedMap[sName]) assignedMap[sName] = [];
      assignedMap[sName].push({ posName: pos.name || pos.role, slot: pos.time_slot || "開場前" });
    });
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-0.5"><UserCog className="w-4 h-4 text-primary" />スタッフ管理</h2>
          <p className="text-[11px] text-muted-foreground">スタッフの追加、編集、削除などの管理が可能です。A-CAST 点呼表からのスタッフリストの取得も可能です。</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{staffList.length}名</span>
          <Button size="sm" variant="outline" className="gap-0.5 h-6 text-[11px] px-2" onClick={() => setShowScrapeModal(true)}>
            <Download className="w-2.5 h-2.5" />取得
          </Button>
        </div>
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-xl p-2 mb-2">
        <div className="flex gap-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="スタッフ名"
            className="flex-1 h-8 text-sm"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備考"
            className="w-24 h-8 text-sm"
          />
          <Button onClick={handleAdd} disabled={!name.trim() || createMutation.isPending} size="sm" className="gap-0.5 h-8 px-2 shrink-0">
            <Plus className="w-3 h-3" />追加
          </Button>
        </div>
      </div>

      {/* Staff list */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">スタッフが登録されていません</p>
        </div>
      ) : (
        <div className="space-y-1">
          {staffList.map((staff) => {
            const assigned = assignedMap[staff.name] || [];
            const unassigned = assigned.length === 0;
            return (
              <div key={staff.id} className={`bg-card border rounded-lg px-2.5 py-1.5 ${unassigned ? "border-amber-300" : "border-border"}`}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                    {staff.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-medium text-xs">{staff.name}</p>
                      {unassigned && (
                        <span className="flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded-full">
                          <AlertCircle className="w-2 h-2" />未配置
                        </span>
                      )}
                    </div>
                    {staff.note && <p className="text-[10px] text-muted-foreground truncate">{staff.note}</p>}
                  </div>
                  <button
                    onClick={() => setEditingStaff(staff)}
                    className="p-1 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`「${staff.name}」を削除しますか？`)) deleteMutation.mutate(staff.id); }}
                    className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {assigned.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-0.5 pl-8">
                    {assigned.map((a, i) => (
                      <span key={i} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TIME_SLOT_COLORS[a.slot]}`}>
                        {a.slot}：{a.posName}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showScrapeModal && (
        <StaffScrapeModal eventId={eventId} onClose={() => setShowScrapeModal(false)} />
      )}

      {editingStaff && (
        <EditModal
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSaved={() => setEditingStaff(null)}
        />
      )}
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Users, AlertCircle } from "lucide-react";
import PositionFormModal from "@/components/PositionFormModal";

const ROLE_COLORS = {
  "受付": "bg-blue-100 text-blue-700 border-blue-200",
  "誘導": "bg-green-100 text-green-700 border-green-200",
  "警備": "bg-red-100 text-red-700 border-red-200",
  "その他": "bg-slate-100 text-slate-600 border-slate-200",
};

const TIME_SLOTS = ["開場前", "開演中", "終演後"];

const TIME_SLOT_STYLES = {
  "開場前": { header: "bg-amber-50 border-amber-200 text-amber-800", badge: "bg-amber-100 text-amber-700 border-amber-300" },
  "開演中": { header: "bg-blue-50 border-blue-200 text-blue-800", badge: "bg-blue-100 text-blue-700 border-blue-300" },
  "終演後": { header: "bg-slate-50 border-slate-200 text-slate-700", badge: "bg-slate-100 text-slate-600 border-slate-300" },
};

function PositionCard({ pos, onEdit, onDelete }) {
  const staffNames = pos.staff_names || [];
  const posLabel = pos.name || pos.role;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
      {/* Position header row */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60 bg-muted/20">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color || "#6366f1" }} />
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[pos.role]}`}>{pos.role}</span>
        {pos.notes && <span className="text-xs text-muted-foreground truncate flex-1">{pos.notes}</span>}
        <div className="flex gap-1 ml-auto flex-shrink-0">
          <button onClick={() => onEdit(pos)} className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(pos.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Staff rows: "ポジション　スタッフ名" per line */}
      {staffNames.length > 0 ? (
        <div className="divide-y divide-border/40">
          {staffNames.map((name, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-2">
              <span className="text-sm font-medium text-foreground w-24 shrink-0">{posLabel}</span>
              <span className="text-muted-foreground text-xs">　</span>
              <span className="text-sm text-foreground">{name}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 text-xs text-muted-foreground">スタッフ未登録</div>
      )}
    </div>
  );
}

export default function StaffList({ eventId }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [defaultSlot, setDefaultSlot] = useState("開場前");
  const queryClient = useQueryClient();

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }),
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">配置表</h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">ポジションが登録されていません</p>
          <p className="text-sm mt-1">「ポジション追加」からスタッフを配置してください</p>
        </div>
      ) : (
        <div className="space-y-6">
          {TIME_SLOTS.map((slot) => {
            const style = TIME_SLOT_STYLES[slot];
            return (
              <div key={slot} className={`border rounded-2xl overflow-hidden ${style.header.split(" ").slice(0, 2).join(" ")}`}>
                {/* Section header */}
                <div className={`flex items-center justify-between px-5 py-3 border-b ${style.header}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base">{slot}</span>
                    <span className="text-xs opacity-70">{grouped[slot].length}件</span>
                  </div>
                  <button
                    onClick={() => openAdd(slot)}
                    className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/60 hover:bg-white/90 transition-colors font-medium"
                  >
                    <Plus className="w-3 h-3" />追加
                  </button>
                </div>

                {/* Positions */}
                <div className="bg-card p-4">
                  {grouped[slot].length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">このタイムスロットにポジションがありません</p>
                  ) : (
                    <div className="grid gap-2">
                      {grouped[slot].map((pos) => (
                        <PositionCard
                          key={pos.id}
                          pos={pos}
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
          <div className="mt-6 border border-amber-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 bg-amber-50 border-b border-amber-200 text-amber-800">
              <AlertCircle className="w-4 h-4" />
              <span className="font-bold text-base">未配置スタッフ</span>
              <span className="text-xs opacity-70">{unassigned.length}名</span>
            </div>
            <div className="bg-card p-4 grid gap-2">
              {unassigned.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-50/50 border border-amber-100">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{s.name}</span>
                  {s.note && <span className="text-xs text-muted-foreground ml-1">{s.note}</span>}
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
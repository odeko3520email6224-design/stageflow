import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import PositionFormModal from "@/components/PositionFormModal";

const ROLE_COLORS = {
  "受付": "bg-blue-100 text-blue-700 border-blue-200",
  "誘導": "bg-green-100 text-green-700 border-green-200",
  "警備": "bg-red-100 text-red-700 border-red-200",
  "その他": "bg-slate-100 text-slate-600 border-slate-200",
};

export default function StaffList({ eventId }) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }, "role"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Position.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positions", eventId] }),
  });

  // Group by role
  const grouped = positions.reduce((acc, p) => {
    const r = p.role || "その他";
    if (!acc[r]) acc[r] = [];
    acc[r].push(p);
    return acc;
  }, {});

  const roleOrder = ["受付", "誘導", "警備", "その他"];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">配置表</h2>
        <Button onClick={() => { setEditing(null); setShowModal(true); }} className="gap-2" size="sm">
          <Plus className="w-4 h-4" />
          ポジション追加
        </Button>
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
          {roleOrder.filter((r) => grouped[r]).map((role) => (
            <div key={role}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ROLE_COLORS[role]}`}>{role}</span>
                <span className="text-xs text-muted-foreground">{grouped[role].length}件</span>
              </div>
              <div className="grid gap-2">
                {grouped[role].map((pos) => (
                  <div
                    key={pos.id}
                    className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors"
                  >
                    {/* Color dot */}
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: pos.color || "#6366f1" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground">{pos.name}</div>
                      {pos.staff_name && (
                        <div className="text-xs text-muted-foreground mt-0.5">担当: {pos.staff_name}</div>
                      )}
                    </div>
                    {pos.staff_count > 1 && (
                      <span className="text-xs text-muted-foreground">{pos.staff_count}名</span>
                    )}
                    {pos.notes && (
                      <span className="text-xs text-muted-foreground hidden sm:block max-w-[160px] truncate">{pos.notes}</span>
                    )}
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditing(pos); setShowModal(true); }}
                        className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (confirm("削除しますか？")) deleteMutation.mutate(pos.id); }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PositionFormModal
          position={editing}
          eventId={eventId}
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
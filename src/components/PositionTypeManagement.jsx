import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Settings } from "lucide-react";
import MapTemplateManagement from "@/components/MapTemplateManagement";

const PRESET_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];

const ROLE_COLORS = {
  "受付": "bg-blue-100 text-blue-700 border-blue-200",
  "誘導": "bg-green-100 text-green-700 border-green-200",
  "警備": "bg-red-100 text-red-700 border-red-200",
  "その他": "bg-slate-100 text-slate-600 border-slate-200",
};

export default function PositionTypeManagement({ eventId }) {
  // eventId is kept for context but PositionTypes are now global (shared across events)
  const [name, setName] = useState("");
  const [role, setRole] = useState("受付");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const queryClient = useQueryClient();

  const { data: positionTypes = [], isLoading } = useQuery({
    queryKey: ["positionTypes"],
    queryFn: () => base44.entities.PositionType.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PositionType.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positionTypes"] });
      setName("");
      setRole("受付");
      setColor(PRESET_COLORS[0]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PositionType.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positionTypes"] }),
  });

  const handleAdd = () => {
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), role, color });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAdd(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><Settings className="w-5 h-5 text-primary" />ポジション設定（全イベント共通）</h2>
        <span className="text-xs text-muted-foreground">{positionTypes.length}件登録中</span>
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-xl p-3 mb-4">
        <p className="text-xs font-medium mb-2 text-muted-foreground">ポジションを追加</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ポジション名（例：メイン受付A）"
            className="flex-1 min-w-[140px] h-8 text-sm"
          />
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <Button onClick={handleAdd} disabled={!name.trim() || createMutation.isPending} size="sm" className="gap-1 h-8 shrink-0">
            <Plus className="w-3.5 h-3.5" />追加
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : positionTypes.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">ポジションが登録されていません</p>
          <p className="text-sm mt-1">上のフォームからポジションを追加してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {positionTypes.map((pt) => (
            <div key={pt.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: pt.color || "#6366f1" }} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{pt.name}</p>
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[pt.role] || ROLE_COLORS["その他"]}`}>{pt.role}</span>
              <button
                onClick={() => { if (confirm(`「${pt.name}」を削除しますか？`)) deleteMutation.mutate(pt.id); }}
                className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <MapTemplateManagement eventId={eventId} />
    </div>
  );
}
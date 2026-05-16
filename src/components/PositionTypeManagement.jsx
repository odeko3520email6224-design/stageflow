import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, Trash2, Settings, Moon, Sun } from "lucide-react";
import MapTemplateManagement from "@/components/MapTemplateManagement";
import PositionPresetManager from "@/components/PositionPresetManager";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/lib/ThemeProvider";

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

const ROLES = ["受付", "誘導", "警備", "その他"];

export default function PositionTypeManagement({ eventId }) {
  // eventId is kept for context but PositionTypes are now global (shared across events)
  const [name, setName] = useState("");
  const [role, setRole] = useState("受付");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [requiredCount, setRequiredCount] = useState(0);
  const queryClient = useQueryClient();
  const { canEdit: isAdmin } = useUserRole();
  const { isDark, setIsDark } = useTheme();

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
      setRequiredCount(0);
    },
  });

  const updateRequiredMutation = useMutation({
    mutationFn: ({ id, required_count }) => base44.entities.PositionType.update(id, { required_count }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positionTypes"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PositionType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positionTypes"] });
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    },
  });

  const handleAdd = () => {
    if (!name.trim()) return;
    createMutation.mutate({ event_id: eventId, name: name.trim(), role, color, required_count: requiredCount });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAdd(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold flex items-center gap-1.5"><Settings className="w-4 h-4 text-primary" />ポジション設定（全イベント共通）</h2>
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
          title={isDark ? 'ライトモード' : 'ダークモード'}
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-500" aria-hidden="true" /> : <Moon className="w-5 h-5 text-slate-600" aria-hidden="true" />}
        </button>
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-xl p-3 mb-3">
        <p className="text-xs font-medium mb-2 text-muted-foreground">ポジションを追加</p>
        <div className="space-y-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ポジション名（例：メイン受付A）"
            className="h-8 text-sm"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-8 text-xs border border-border rounded-lg px-2 bg-background flex-1 min-w-[80px]"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground shrink-0">必要人数</span>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button type="button" onClick={() => setRequiredCount((n) => Math.max(0, n - 1))} className="w-7 h-8 flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={requiredCount}
                  onChange={(e) => setRequiredCount(Number(e.target.value))}
                  className="w-10 h-8 text-xs bg-background text-center border-x border-border focus:outline-none"
                />
                <button type="button" onClick={() => setRequiredCount((n) => n + 1)} className="w-7 h-8 flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 flex-1">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <Button onClick={handleAdd} disabled={!isAdmin || !name.trim() || createMutation.isPending} size="sm" className="gap-1 h-8 shrink-0">
              <Plus className="w-3.5 h-3.5" />追加
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : positionTypes.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Settings className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">ポジションが登録されていません</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-3">
          {positionTypes.map((pt, idx) => (
            <div key={pt.id} className={`flex items-center gap-2 px-3 py-2 ${idx > 0 ? "border-t border-border/50" : ""}`}>
              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: pt.color || "#6366f1" }} />
              <div className="flex-1 min-w-0">
                <span className="font-medium text-xs">{pt.name}</span>
              </div>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${ROLE_COLORS[pt.role] || ROLE_COLORS["その他"]}`}>{pt.role}</span>
              {/* 必要人数 */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground">必要:</span>
                <div className="flex items-center border border-border rounded overflow-hidden">
                  <button type="button" disabled={!isAdmin} onClick={() => updateRequiredMutation.mutate({ id: pt.id, required_count: Math.max(0, (pt.required_count || 0) - 1) })} className="w-5 h-6 flex items-center justify-center bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none text-muted-foreground">
                    <Minus className="w-2.5 h-2.5" />
                  </button>
                  <span className="w-7 text-[11px] text-center bg-background border-x border-border leading-6">{pt.required_count || 0}</span>
                  <button type="button" disabled={!isAdmin} onClick={() => updateRequiredMutation.mutate({ id: pt.id, required_count: (pt.required_count || 0) + 1 })} className="w-5 h-6 flex items-center justify-center bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none text-muted-foreground">
                    <Plus className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => { if (confirm(`「${pt.name}」を削除しますか？`)) deleteMutation.mutate(pt.id); }}
                disabled={!isAdmin}
                className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border my-4" />
      <PositionPresetManager eventId={eventId} />
      <MapTemplateManagement eventId={eventId} />
    </div>
  );
}
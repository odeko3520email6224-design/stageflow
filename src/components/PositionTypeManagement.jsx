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
import { TIME_SLOT_STYLES } from "@/lib/constants";

const PRESET_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];

const ROLE_COLORS = {
  "受付": "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700",
  "誘導": "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700",
  "警備": "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  "その他": "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
};

const ROLES = ["受付", "誘導", "警備", "その他"];

// 時間帯ごとの必要人数コントロール（横並びコンパクト版）
function SlotCountControl({ label, value, onChange, disabled, styleClass }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${styleClass}`}>
      <span className="text-[10px] font-semibold flex-1">{label}</span>
      <div className="flex items-center border border-border/60 rounded overflow-hidden bg-background">
        <button type="button" disabled={disabled} onClick={() => onChange(Math.max(0, value - 1))}
          className="w-5 h-5 flex items-center justify-center bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none text-muted-foreground">
          <Minus className="w-2.5 h-2.5" />
        </button>
        <span className="w-6 text-[11px] text-center leading-5">{value}</span>
        <button type="button" disabled={disabled} onClick={() => onChange(value + 1)}
          className="w-5 h-5 flex items-center justify-center bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:pointer-events-none text-muted-foreground">
          <Plus className="w-2.5 h-2.5" />
        </button>
      </div>
    </div>
  );
}

export default function PositionTypeManagement({ eventId }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("受付");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [reqBefore, setReqBefore] = useState(0);
  const [reqDuring, setReqDuring] = useState(0);
  const [reqAfter, setReqAfter] = useState(0);
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
      setReqBefore(0);
      setReqDuring(0);
      setReqAfter(0);
    },
  });

  const updateSlotCountMutation = useMutation({
    mutationFn: ({ id, field, value }) => base44.entities.PositionType.update(id, { [field]: value }),
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
    createMutation.mutate({
      event_id: eventId,
      name: name.trim(),
      role,
      color,
      required_count: reqBefore, // 後方互換
      required_count_before: reqBefore,
      required_count_during: reqDuring,
      required_count_after: reqAfter,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAdd(); }
  };

  const SLOT_FIELDS = [
    { slot: "開場中", field: "required_count_before", styleClass: TIME_SLOT_STYLES["開場中"].header },
    { slot: "開演中", field: "required_count_during", styleClass: TIME_SLOT_STYLES["開演中"].header },
    { slot: "終演後", field: "required_count_after", styleClass: TIME_SLOT_STYLES["終演後"].header },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold flex items-center gap-1.5"><Settings className="w-4 h-4 text-primary" />ポジション設定（全イベント共通）</h2>
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-xl p-2.5 mb-2">
        <p className="text-[11px] font-medium mb-1.5 text-muted-foreground">ポジションを追加</p>
        <div className="space-y-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ポジション名（例：メイン受付A）"
            className="h-8 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-7 text-xs border border-border rounded-lg px-2 bg-background w-full"
          >
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {/* 時間帯別必要人数（プリセット適用時の初期値。各イベントの配置表から個別変更可能） */}
          <div className="flex gap-1">
            <SlotCountControl label="開場中" value={reqBefore} onChange={setReqBefore} disabled={false} styleClass={TIME_SLOT_STYLES["開場中"].header} />
            <SlotCountControl label="開演中" value={reqDuring} onChange={setReqDuring} disabled={false} styleClass={TIME_SLOT_STYLES["開演中"].header} />
            <SlotCountControl label="終演後" value={reqAfter} onChange={setReqAfter} disabled={false} styleClass={TIME_SLOT_STYLES["終演後"].header} />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 flex-1">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <Button onClick={handleAdd} disabled={!isAdmin || !name.trim() || createMutation.isPending} size="sm" className="gap-1 h-7 shrink-0">
              <Plus className="w-3 h-3" />追加
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
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-2">
          {positionTypes.map((pt, idx) => (
            <div key={pt.id} className={`px-2.5 py-1.5 ${idx > 0 ? "border-t border-border/50" : ""}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: pt.color || "#6366f1" }} />
                <span className="font-medium text-xs flex-1">{pt.name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 ${ROLE_COLORS[pt.role] || ROLE_COLORS["その他"]}`}>{pt.role}</span>
                <button
                  onClick={() => { if (confirm(`「${pt.name}」を削除しますか？`)) deleteMutation.mutate(pt.id); }}
                  disabled={!isAdmin}
                  className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* 時間帯別必要人数 */}
              <div className="flex gap-1 pl-5">
                {SLOT_FIELDS.map(({ slot, field, styleClass }) => (
                  <SlotCountControl
                    key={field}
                    label={slot}
                    value={pt[field] ?? pt.required_count ?? 0}
                    onChange={(v) => updateSlotCountMutation.mutate({ id: pt.id, field, value: v })}
                    disabled={!isAdmin}
                    styleClass={styleClass}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-border my-3" />
      <PositionPresetManager eventId={eventId} />
      <MapTemplateManagement eventId={eventId} />
    </div>
  );
}
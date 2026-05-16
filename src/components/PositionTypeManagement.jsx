import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Minus, Trash2, Settings, Moon, Sun, GripVertical } from "lucide-react";
import MapTemplateManagement from "@/components/MapTemplateManagement";
import PositionPresetManager from "@/components/PositionPresetManager";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/lib/ThemeProvider";
import { TIME_SLOT_STYLES } from "@/lib/constants";
import ConfirmDialog from "@/components/ConfirmDialog";

const PRESET_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];

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
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [reqBefore, setReqBefore] = useState(0);
  const [reqDuring, setReqDuring] = useState(0);
  const [reqAfter, setReqAfter] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const queryClient = useQueryClient();
  const { canEdit: isAdmin } = useUserRole();
  const { isDark, setIsDark } = useTheme();

  const { data: positionTypes = [], isLoading } = useQuery({
    queryKey: ["positionTypes"],
    queryFn: () => base44.entities.PositionType.list(),
    select: (d) => [...d].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PositionType.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positionTypes"] });
      setName("");
      setColor(PRESET_COLORS[0]);
      setReqBefore(0); setReqDuring(0); setReqAfter(0);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PositionType.update(id, data),
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
    const maxOrder = positionTypes.length > 0 ? Math.max(...positionTypes.map((p) => p.order ?? 0)) : -1;
    createMutation.mutate({
      name: name.trim(),
      color,
      required_count: reqBefore,
      required_count_before: reqBefore,
      required_count_during: reqDuring,
      required_count_after: reqAfter,
      order: maxOrder + 1,
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAdd(); }
  };

  const handleDragStart = (e, id) => { setDraggingId(id); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e, id) => { e.preventDefault(); if (id !== draggingId) setDragOverId(id); };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return; }
    const fromIdx = positionTypes.findIndex((p) => p.id === draggingId);
    const toIdx = positionTypes.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggingId(null); setDragOverId(null); return; }
    const reordered = [...positionTypes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    reordered.forEach((pt, idx) => { base44.entities.PositionType.update(pt.id, { order: idx }); });
    queryClient.setQueryData(["positionTypes"], reordered.map((pt, idx) => ({ ...pt, order: idx })));
    setDraggingId(null); setDragOverId(null);
  };

  const SLOT_FIELDS = [
    { slot: "開場中", field: "required_count_before", styleClass: TIME_SLOT_STYLES["開場中"].header },
    { slot: "開演中", field: "required_count_during", styleClass: TIME_SLOT_STYLES["開演中"].header },
    { slot: "終演後", field: "required_count_after", styleClass: TIME_SLOT_STYLES["終演後"].header },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-0.5"><Settings className="w-4 h-4 text-primary" />ポジション設定</h2>
          <p className="text-[11px] text-muted-foreground">必要人数はプリセット適用時の初期値です。各イベントの配置表タブで個別変更できます。</p>
        </div>
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
          aria-label={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-xl p-2.5 mb-2">
        <p className="text-[11px] font-medium mb-1.5 text-muted-foreground">ポジションを追加</p>
        <div className="space-y-1.5">
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="ポジション名（例：メイン受付A）" className="h-8 text-sm" />
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
            <div key={pt.id}
              className={`px-2.5 py-1.5 ${idx > 0 ? "border-t border-border/50" : ""} ${draggingId === pt.id ? "opacity-40" : ""} ${dragOverId === pt.id ? "ring-2 ring-inset ring-primary" : ""}`}
              onDragOver={(e) => handleDragOver(e, pt.id)}
              onDrop={(e) => handleDrop(e, pt.id)}
            >
              <div className="flex items-center gap-2 mb-1">
                {isAdmin && (
                  <div draggable onDragStart={(e) => handleDragStart(e, pt.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: pt.color || "#6366f1" }} />
                <span className="font-medium text-xs flex-1">{pt.name}</span>
                <button onClick={() => setConfirmDelete({ id: pt.id, name: pt.name })} disabled={!isAdmin}
                  className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-1 pl-5">
                {SLOT_FIELDS.map(({ slot, field, styleClass }) => (
                  <SlotCountControl key={field} label={slot} value={pt[field] ?? pt.required_count ?? 0}
                    onChange={(v) => updateMutation.mutate({ id: pt.id, data: { [field]: v } })}
                    disabled={!isAdmin} styleClass={styleClass} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog message={`「${confirmDelete.name}」を削除しますか？`} confirmLabel="削除"
          onConfirm={() => { deleteMutation.mutate(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)} />
      )}

      <div className="border-t border-border my-3" />
      <PositionPresetManager eventId={eventId} />
      <MapTemplateManagement eventId={eventId} />
    </div>
  );
}
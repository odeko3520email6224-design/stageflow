import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown, ChevronUp, Zap, X, BookOpen, Pencil } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { TIME_SLOTS, TIME_SLOT_STYLES } from "@/lib/constants";

// PositionType selector per time slot
function SlotPositionSelector({ slot, selectedIds, positionTypes, onChange }) {
  const style = TIME_SLOT_STYLES[slot];
  const available = positionTypes.filter((pt) => !selectedIds.includes(pt.id));
  const selected = positionTypes.filter((pt) => selectedIds.includes(pt.id));

  return (
    <div className={`border rounded-xl overflow-hidden mb-3`}>
      <div className={`flex items-center justify-between px-3 py-2 border-b ${style.header}`}>
        <span className="font-bold text-xs">{slot}</span>
        <span className="text-xs opacity-70">{selected.length}件</span>
      </div>
      <div className="bg-card p-2 space-y-1">
        {selected.map((pt) => (
          <div key={pt.id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted/30 border border-border/50">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pt.color || "#6366f1" }} />
            <span className="text-xs flex-1">{pt.name}</span>
            <span className="text-[10px] text-muted-foreground">{pt.role}</span>
            <button
              onClick={() => onChange(selectedIds.filter((id) => id !== pt.id))}
              className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {available.length > 0 && (
          <div className="pt-1">
            <select
              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-background h-8"
              value=""
              onChange={(e) => {
                if (e.target.value) onChange([...selectedIds, e.target.value]);
              }}
            >
              <option value="">＋ ポジションを追加...</option>
              {available.map((pt) => (
                <option key={pt.id} value={pt.id}>{pt.name}（{pt.role}）</option>
              ))}
            </select>
          </div>
        )}
        {positionTypes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">ポジション設定から登録してください</p>
        )}
      </div>
    </div>
  );
}

function PresetCard({ preset, eventId, event, onDelete, isAdmin, positionTypes }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(preset.name);
  const [editDesc, setEditDesc] = useState(preset.description || "");
  const [editSlots, setEditSlots] = useState(preset.slot_positions || { "開場前": [], "開演中": [], "終演後": [] });
  const queryClient = useQueryClient();

  const isActive = event?.active_preset_id === preset.id;

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.PositionPreset.update(preset.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positionPresets"] });
      setEditing(false);
    },
  });

  const handleEditSave = () => {
    if (!editName.trim()) return;
    updateMutation.mutate({
      name: editName.trim(),
      description: editDesc.trim(),
      slot_positions: editSlots,
    });
  };

  const startEdit = () => {
    setEditName(preset.name);
    setEditDesc(preset.description || "");
    setEditSlots(preset.slot_positions || { "開場前": [], "開演中": [], "終演後": [] });
    setEditing(true);
    setExpanded(false);
  };

  const applyMutation = useMutation({
    mutationFn: async () => {
      // 既存ポジションを削除してプリセットから再生成
      const existingPositions = await base44.entities.Position.filter({ event_id: eventId });
      if (existingPositions.length > 0) {
        await Promise.all(existingPositions.map((p) => base44.entities.Position.delete(p.id)));
      }

      // プリセットのポジションを生成（全スロット分を並列作成）
      const slotMap = preset.slot_positions || {};
      const creates = [];
      for (const slot of TIME_SLOTS) {
        const ids = slotMap[slot] || [];
        for (const ptId of ids) {
          const pt = positionTypes.find((p) => p.id === ptId);
          if (pt) {
            creates.push(base44.entities.Position.create({
              event_id: eventId,
              name: pt.name,
              role: pt.role || "受付",
              color: pt.color || "#6366f1",
              time_slot: slot,
              staff_names: [],
            }));
          }
        }
      }
      await Promise.all(creates);

      // イベントにactive_preset_idを設定
      await base44.entities.Event.update(eventId, { active_preset_id: preset.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["positionPreset", preset.id] });
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Event.update(eventId, { active_preset_id: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
    },
  });

  const slotMap = preset.slot_positions || {};

  return (
    <div className={`bg-card border rounded-xl overflow-hidden ${isActive ? "border-primary" : "border-border"}`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm">{preset.name}</p>
            {isActive && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">適用中</span>
            )}
          </div>
          {preset.description && <p className="text-xs text-muted-foreground">{preset.description}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">
            {TIME_SLOTS.map((s) => `${s}: ${(slotMap[s] || []).length}件`).join("　")}
          </p>
        </div>

        {isActive ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1 h-7 text-xs shrink-0"
            disabled={!isAdmin || clearMutation.isPending}
            onClick={() => { if (confirm("プリセットの適用を解除しますか？")) clearMutation.mutate(); }}
          >
            {clearMutation.isPending ? "解除中..." : "解除"}
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-1 h-7 text-xs shrink-0"
            disabled={!isAdmin || applyMutation.isPending}
            onClick={() => {
              if (confirm(`「${preset.name}」を適用しますか？\n現在のポジションは一度リセットされます。`)) {
                applyMutation.mutate();
              }
            }}
          >
            <Zap className="w-3 h-3" />
            {applyMutation.isPending ? "適用中..." : "適用"}
          </Button>
        )}

        {isAdmin && (
          <button
            onClick={startEdit}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => { if (confirm(`「${preset.name}」を削除しますか？`)) onDelete(preset.id); }}
          disabled={!isAdmin}
          className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {editing && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground mb-2">プリセットを編集</p>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="プリセット名"
            className="h-8 text-sm"
          />
          <Input
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="説明（任意）"
            className="h-8 text-sm"
          />
          <p className="text-xs font-medium pt-1">タイムスロットごとのポジション</p>
          {TIME_SLOTS.map((slot) => (
            <SlotPositionSelector
              key={slot}
              slot={slot}
              selectedIds={editSlots[slot] || []}
              positionTypes={positionTypes}
              onChange={(ids) => setEditSlots((prev) => ({ ...prev, [slot]: ids }))}
            />
          ))}
          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setEditing(false)}>キャンセル</Button>
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              disabled={!editName.trim() || updateMutation.isPending}
              onClick={handleEditSave}
            >
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      )}

      {expanded && !editing && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {TIME_SLOTS.map((slot) => {
            const ids = slotMap[slot] || [];
            const pts = positionTypes.filter((pt) => ids.includes(pt.id));
            if (pts.length === 0) return null;
            return (
              <div key={slot}>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TIME_SLOT_STYLES[slot].badge}`}>{slot}</span>
                <div className="mt-1 space-y-1 pl-2">
                  {pts.map((pt) => (
                    <div key={pt.id} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pt.color || "#6366f1" }} />
                      <span>{pt.name}</span>
                      <span className="text-muted-foreground">{pt.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PositionPresetManager({ eventId }) {
  const [creating, setCreating] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDesc, setPresetDesc] = useState("");
  // slot_positions: { "開場前": [ptId, ...], "開演中": [...], "終演後": [...] }
  const [slotSelections, setSlotSelections] = useState({ "開場前": [], "開演中": [], "終演後": [] });
  const queryClient = useQueryClient();
  const { canEdit: isAdmin } = useUserRole();

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["positionPresets"],
    queryFn: () => base44.entities.PositionPreset.list(),
  });

  const { data: positionTypes = [] } = useQuery({
    queryKey: ["positionTypes"],
    queryFn: () => base44.entities.PositionType.list(),
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }),
    select: (d) => d[0],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PositionPreset.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positionPresets"] });
      setCreating(false);
      setPresetName("");
      setPresetDesc("");
      setSlotSelections({ "開場前": [], "開演中": [], "終演後": [] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PositionPreset.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positionPresets"] }),
  });

  const handleSave = () => {
    if (!presetName.trim()) return;
    const totalCount = Object.values(slotSelections).flat().length;
    if (totalCount === 0) return;
    createMutation.mutate({
      name: presetName.trim(),
      description: presetDesc.trim(),
      slot_positions: slotSelections,
      // legacy positions field kept for compatibility
      positions: [],
    });
  };

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-primary" />ポジションプリセット
        </h2>
        {isAdmin && !creating && (
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5" />新規プリセット
          </Button>
        )}
      </div>

      {creating && (
        <div className="bg-card border border-border rounded-xl p-3 mb-3">
          <p className="text-xs font-semibold text-muted-foreground mb-3">新規プリセット作成</p>
          <div className="space-y-2 mb-4">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="プリセット名（例：ホールA標準配置）"
              className="h-8 text-sm"
            />
            <Input
              value={presetDesc}
              onChange={(e) => setPresetDesc(e.target.value)}
              placeholder="説明（任意）"
              className="h-8 text-sm"
            />
          </div>

          <p className="text-xs font-medium mb-2">タイムスロットごとのポジション</p>
          {positionTypes.length === 0 && (
            <p className="text-xs text-amber-600 mb-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              先に「ポジション設定」からポジションを登録してください
            </p>
          )}
          {TIME_SLOTS.map((slot) => (
            <SlotPositionSelector
              key={slot}
              slot={slot}
              selectedIds={slotSelections[slot]}
              positionTypes={positionTypes}
              onChange={(ids) => setSlotSelections((prev) => ({ ...prev, [slot]: ids }))}
            />
          ))}

          <div className="flex gap-2 mt-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setCreating(false)}>キャンセル</Button>
            <Button
              size="sm"
              className="flex-1 h-8 text-xs"
              disabled={!presetName.trim() || Object.values(slotSelections).flat().length === 0 || createMutation.isPending}
              onClick={handleSave}
            >
              {createMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : presets.length === 0 && !creating ? (
        <p className="text-xs text-muted-foreground text-center py-6">プリセットが登録されていません</p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              eventId={eventId}
              event={event}
              onDelete={(id) => deleteMutation.mutate(id)}
              isAdmin={isAdmin}
              positionTypes={positionTypes}
            />
          ))}
        </div>
      )}
    </div>
  );
}
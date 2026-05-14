import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronDown, ChevronUp, Zap, X, Check } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const TIME_SLOTS = ["開場前", "開演中", "終演後"];
const TIME_SLOT_STYLES = {
  "開場前": "bg-amber-50 border-amber-200 text-amber-800",
  "開演中": "bg-blue-50 border-blue-200 text-blue-800",
  "終演後": "bg-slate-50 border-slate-200 text-slate-700",
};
const PRESET_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];
const ROLES = ["受付", "誘導", "警備", "その他"];

function PositionRow({ pos, onChange, onDelete }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
      <select
        value={pos.time_slot}
        onChange={(e) => onChange({ ...pos, time_slot: e.target.value })}
        className="text-xs border border-border rounded px-1 py-0.5 bg-background h-7 shrink-0"
      >
        {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <Input
        value={pos.name}
        onChange={(e) => onChange({ ...pos, name: e.target.value })}
        placeholder="ポジション名"
        className="h-7 text-xs flex-1 min-w-[80px]"
      />
      <select
        value={pos.role}
        onChange={(e) => onChange({ ...pos, role: e.target.value })}
        className="text-xs border border-border rounded px-1 py-0.5 bg-background h-7 shrink-0"
      >
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <div className="flex gap-1 shrink-0">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ ...pos, color: c })}
            className={`w-4 h-4 rounded-full border-2 transition-transform ${pos.color === c ? "border-foreground scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <button onClick={onDelete} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function PresetCard({ preset, eventId, onDelete, isAdmin }) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);
  const queryClient = useQueryClient();

  const applyMutation = useMutation({
    mutationFn: async () => {
      const positions = preset.positions || [];
      await Promise.all(
        positions.map((pos) =>
          base44.entities.Position.create({
            event_id: eventId,
            name: pos.name,
            role: pos.role || "受付",
            color: pos.color || "#6366f1",
            time_slot: pos.time_slot || "開場前",
            staff_names: [],
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
      setApplying(false);
    },
  });

  const grouped = TIME_SLOTS.reduce((acc, slot) => {
    acc[slot] = (preset.positions || []).filter((p) => (p.time_slot || "開場前") === slot);
    return acc;
  }, {});

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{preset.name}</p>
          {preset.description && <p className="text-xs text-muted-foreground">{preset.description}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">{(preset.positions || []).length}ポジション</p>
        </div>
        <Button
          size="sm"
          className="gap-1 h-7 text-xs shrink-0"
          disabled={!isAdmin || applyMutation.isPending}
          onClick={() => {
            if (confirm(`「${preset.name}」のポジションをこのイベントに一括追加しますか？`)) {
              applyMutation.mutate();
            }
          }}
        >
          <Zap className="w-3 h-3" />
          {applyMutation.isPending ? "追加中..." : "適用"}
        </Button>
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

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          {TIME_SLOTS.map((slot) => grouped[slot].length > 0 && (
            <div key={slot}>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TIME_SLOT_STYLES[slot]}`}>{slot}</span>
              <div className="mt-1 space-y-1 pl-2">
                {grouped[slot].map((pos, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: pos.color || "#6366f1" }} />
                    <span>{pos.name}</span>
                    <span className="text-muted-foreground">{pos.role}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {(preset.positions || []).length === 0 && (
            <p className="text-xs text-muted-foreground">ポジションが登録されていません</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PositionPresetManager({ eventId }) {
  const [creating, setCreating] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDesc, setPresetDesc] = useState("");
  const [presetPositions, setPresetPositions] = useState([
    { time_slot: "開場前", name: "", role: "受付", color: PRESET_COLORS[0] },
  ]);
  const queryClient = useQueryClient();
  const { canEdit: isAdmin } = useUserRole();

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["positionPresets"],
    queryFn: () => base44.entities.PositionPreset.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PositionPreset.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positionPresets"] });
      setCreating(false);
      setPresetName("");
      setPresetDesc("");
      setPresetPositions([{ time_slot: "開場前", name: "", role: "受付", color: PRESET_COLORS[0] }]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PositionPreset.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positionPresets"] }),
  });

  const updatePosition = (index, updated) => {
    setPresetPositions((prev) => prev.map((p, i) => i === index ? updated : p));
  };

  const addRow = (slot = "開場前") => {
    setPresetPositions((prev) => [...prev, { time_slot: slot, name: "", role: "受付", color: PRESET_COLORS[0] }]);
  };

  const handleSave = () => {
    if (!presetName.trim()) return;
    const validPositions = presetPositions.filter((p) => p.name.trim());
    createMutation.mutate({ name: presetName.trim(), description: presetDesc.trim(), positions: validPositions });
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />ポジションプリセット
        </h3>
        {isAdmin && !creating && (
          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5" />新規プリセット
          </Button>
        )}
      </div>

      {creating && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">新規プリセット作成</p>
          <div className="space-y-2 mb-3">
            <Input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              placeholder="プリセット名（例：標準配置、大型ライブ）"
              className="h-8 text-sm"
            />
            <Input
              value={presetDesc}
              onChange={(e) => setPresetDesc(e.target.value)}
              placeholder="説明（任意）"
              className="h-8 text-sm"
            />
          </div>

          <p className="text-xs font-medium mb-1">ポジション一覧</p>
          <div className="border border-border rounded-lg overflow-hidden mb-2">
            {presetPositions.map((pos, i) => (
              <PositionRow
                key={i}
                pos={pos}
                onChange={(updated) => updatePosition(i, updated)}
                onDelete={() => setPresetPositions((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
          <div className="flex gap-2 mb-3">
            {TIME_SLOTS.map((slot) => (
              <button
                key={slot}
                onClick={() => addRow(slot)}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 hover:opacity-80 transition-opacity ${TIME_SLOT_STYLES[slot]}`}
              >
                <Plus className="w-2.5 h-2.5" />{slot}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => setCreating(false)}>キャンセル</Button>
            <Button size="sm" className="flex-1 h-8 text-xs" disabled={!presetName.trim() || createMutation.isPending} onClick={handleSave}>
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
              onDelete={(id) => deleteMutation.mutate(id)}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
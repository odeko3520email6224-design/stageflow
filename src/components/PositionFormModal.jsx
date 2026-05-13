import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, UserMinus } from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];

export default function PositionFormModal({ position, eventId, defaultTimeSlot = "開場前", onClose, onSaved }) {
  const [form, setForm] = useState({
    name: position?.name || "",
    role: position?.role || "受付",
    time_slot: position?.time_slot || defaultTimeSlot,
    staff_names: position?.staff_names || [],
    notes: position?.notes || "",
    color: position?.color || PRESET_COLORS[0],
    map_x: position?.map_x ?? null,
    map_y: position?.map_y ?? null,
    event_id: eventId,
  });
  const [newStaff, setNewStaff] = useState("");

  const mutation = useMutation({
    mutationFn: (data) =>
      position
        ? base44.entities.Position.update(position.id, data)
        : base44.entities.Position.create(data),
    onSuccess: onSaved,
  });

  const addStaff = () => {
    const name = newStaff.trim();
    if (!name) return;
    setForm((f) => ({ ...f, staff_names: [...f.staff_names, name] }));
    setNewStaff("");
  };

  const removeStaff = (idx) => {
    setForm((f) => ({ ...f, staff_names: f.staff_names.filter((_, i) => i !== idx) }));
  };

  const handleStaffKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addStaff(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{position ? "ポジション編集" : "ポジション追加"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>ポジション名 *</Label>
            <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：メイン受付A" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>時間帯</Label>
              <Select value={form.time_slot} onValueChange={(v) => setForm({ ...form, time_slot: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="開場前">開場前</SelectItem>
                  <SelectItem value="開演中">開演中</SelectItem>
                  <SelectItem value="終演後">終演後</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>役割</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="受付">受付</SelectItem>
                  <SelectItem value="誘導">誘導</SelectItem>
                  <SelectItem value="警備">警備</SelectItem>
                  <SelectItem value="その他">その他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Staff names */}
          <div>
            <Label>担当スタッフ</Label>
            <div className="mt-2 space-y-1.5">
              {form.staff_names.map((name, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                  <span className="flex-1 text-sm">{name}</span>
                  <button onClick={() => removeStaff(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={newStaff}
                  onChange={(e) => setNewStaff(e.target.value)}
                  onKeyDown={handleStaffKeyDown}
                  placeholder="名前を入力してEnter"
                  className="text-sm"
                />
                <Button type="button" size="sm" variant="outline" onClick={addStaff} disabled={!newStaff.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div>
            <Label>マップ表示色</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>備考</Label>
            <Input className="mt-1" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="メモなど" />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>キャンセル</Button>
          <Button
            className="flex-1"
            disabled={!form.name || mutation.isPending}
            onClick={() => {
              // 入力中のスタッフ名も忘れずに含める
              const finalForm = newStaff.trim()
                ? { ...form, staff_names: [...form.staff_names, newStaff.trim()] }
                : form;
              mutation.mutate(finalForm);
            }}
          >
            {mutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
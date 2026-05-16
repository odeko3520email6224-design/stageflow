import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { X, Check } from "lucide-react";

const PRESET_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];

export default function PositionFormModal({ position, eventId, defaultTimeSlot = "開場中", onClose, onSaved }) {
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

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  // PositionType list for name selection (global, not event-specific)
  const { data: positionTypes = [] } = useQuery({
    queryKey: ["positionTypes"],
    queryFn: () => base44.entities.PositionType.list(),
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) =>
      position
        ? base44.entities.Position.update(position.id, data)
        : base44.entities.Position.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
      queryClient.invalidateQueries({ queryKey: ["staff", eventId] });
      onSaved();
    },
  });

  // Auto-save on form changes (only for existing positions)
  // Text fields (name, notes) use 500ms debounce; all other changes save instantly
  const prevFormRef = useRef(form);
  const isTextChange = (prev, cur) =>
    prev.name !== cur.name || prev.notes !== cur.notes;
  const isNonTextChange = (prev, cur) =>
    prev.role !== cur.role || prev.time_slot !== cur.time_slot ||
    prev.staff_names !== cur.staff_names || prev.color !== cur.color;

  useEffect(() => {
    if (!position) return;
    const prev = prevFormRef.current;
    const textChanged = isTextChange(prev, form);
    const nonTextChanged = isNonTextChange(prev, form);
    if (!textChanged && !nonTextChanged) return;

    const delay = nonTextChanged ? 0 : 500;
    const timer = setTimeout(() => {
      mutation.mutate({ ...form, name: form.name || form.role }, {
        onSuccess: () => {
          toast.success("保存しました");
          prevFormRef.current = form;
        }
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [form]);

  const toggleStaff = (staffName) => {
    setForm((f) => {
      const exists = f.staff_names.includes(staffName);
      return {
        ...f,
        staff_names: exists
          ? f.staff_names.filter((n) => n !== staffName)
          : [...f.staff_names, staffName],
      };
    });
  };

  const handlePositionTypeSelect = (ptId) => {
    const pt = positionTypes.find((p) => p.id === ptId);
    if (pt) setForm((f) => ({ ...f, name: pt.name, role: pt.role, color: pt.color || f.color }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">{position ? "ポジション編集" : "ポジション追加"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="閉じる">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Position type selector */}
          <div>
            <Label>ポジション</Label>
            {positionTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-1">管理タブでポジションを登録してください</p>
            ) : (
              <ResponsiveSelect
                value={positionTypes.find((pt) => pt.name === form.name)?.id || ""}
                onValueChange={handlePositionTypeSelect}
                options={positionTypes.map((pt) => ({
                  value: pt.id,
                  label: pt.name,
                }))}
                placeholder="ポジションを選択"
              />
            )}
          </div>

          <div>
            <Label>時間帯</Label>
            <ResponsiveSelect
              value={form.time_slot}
              onValueChange={(v) => setForm({ ...form, time_slot: v })}
              options={[
                { value: "開場中", label: "開場中" },
                { value: "開演中", label: "開演中" },
                { value: "終演後", label: "終演後" },
              ]}
              placeholder="時間帯を選択"
            />
          </div>

          {/* Staff selection - checklist dropdown */}
          <div>
            <Label>担当スタッフ</Label>
            {staffList.length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">スタッフ管理タブでスタッフを登録してください</p>
            ) : (
              <div className="mt-2 border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {staffList.map((staff) => {
                  const selected = form.staff_names.includes(staff.name);
                  return (
                    <button
                      key={staff.id}
                      type="button"
                      onClick={() => toggleStaff(staff.name)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left border-b border-border/50 last:border-b-0 transition-colors ${
                        selected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        selected ? "bg-primary border-primary" : "border-border"
                      }`}>
                        {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      {staff.name}
                      {staff.note && <span className="text-xs text-muted-foreground ml-auto">({staff.note})</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {form.staff_names.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">{form.staff_names.length}名選択中</p>
            )}
          </div>

          <div>
            <Label>マップ表示色</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
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

        <div className="flex gap-2 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>閉じる</Button>
          {!position && (
            <Button
              className="flex-1"
              disabled={!form.name || mutation.isPending}
              onClick={() => mutation.mutate({ ...form, name: form.name || form.role }, {
                onSuccess: () => {
                  toast.success("作成しました");
                  setTimeout(onClose, 500);
                }
              })}
            >
              {mutation.isPending ? "作成中..." : "作成"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
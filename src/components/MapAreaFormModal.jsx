import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { X } from "lucide-react";
import { motion } from "framer-motion";

const AREA_COLORS = [
  { label: "グレー", value: "#e2e8f0" },
  { label: "青", value: "#bfdbfe" },
  { label: "緑", value: "#bbf7d0" },
  { label: "黄", value: "#fef9c3" },
  { label: "赤", value: "#fecaca" },
  { label: "紫", value: "#e9d5ff" },
  { label: "オレンジ", value: "#fed7aa" },
];

export default function MapAreaFormModal({ area, eventId, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: area?.name || "",
    type: area?.type || "rectangle",
    x: area?.x ?? 10,
    y: area?.y ?? 10,
    width: area?.width ?? 25,
    height: area?.height ?? 20,
    color: area?.color || "#e2e8f0",
    event_id: eventId,
  });

  const mutation = useMutation({
    mutationFn: (data) =>
      area
        ? base44.entities.MapArea.update(area.id, data)
        : base44.entities.MapArea.create(data),
    onSuccess: onSaved,
  });

  // Auto-save: text fields (name) → 500ms, others (type, x, y, width, height, color) → instant
  const prevFormRef = useRef(form);
  const isTextChange = (prev, cur) => prev.name !== cur.name;
  const isNonTextChange = (prev, cur) =>
    prev.type !== cur.type || prev.x !== cur.x || prev.y !== cur.y ||
    prev.width !== cur.width || prev.height !== cur.height || prev.color !== cur.color;

  useEffect(() => {
    if (!area || !form.name) return;
    const prev = prevFormRef.current;
    const textChanged = isTextChange(prev, form);
    const nonTextChanged = isNonTextChange(prev, form);
    if (!textChanged && !nonTextChanged) return;

    const delay = nonTextChanged ? 0 : 500;
    const timer = setTimeout(() => {
      mutation.mutate(form, {
        onSuccess: () => {
          toast.success("保存しました");
          prevFormRef.current = form;
        }
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [form]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6 max-h-[92vh] overflow-y-auto"
        initial={{ y: 34, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{area ? "エリア編集" : "エリア追加"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <Label>エリア名 *</Label>
            <Input className="mt-1" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="例：ステージ、メイン客席" />
          </div>
          <div>
            <Label>図形</Label>
            <ResponsiveSelect
              value={form.type}
              onValueChange={(v) => set("type", v)}
              options={[
                { value: "rectangle", label: "長方形" },
                { value: "circle", label: "円形" },
              ]}
              placeholder="図形を選択"
            />
          </div>
          <div>
            <Label>色</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {AREA_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => set("color", c.value)}
                  title={c.label}
                  className={`w-7 h-7 rounded-md border-2 transition-transform ${form.color === c.value ? "border-foreground scale-110" : "border-border"}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>X位置（%）</Label>
              <Input className="mt-1" type="number" min={0} max={95} value={form.x} onChange={(e) => set("x", Number(e.target.value))} />
            </div>
            <div>
              <Label>Y位置（%）</Label>
              <Input className="mt-1" type="number" min={0} max={95} value={form.y} onChange={(e) => set("y", Number(e.target.value))} />
            </div>
            <div>
              <Label>幅（%）</Label>
              <Input className="mt-1" type="number" min={3} max={90} value={form.width} onChange={(e) => set("width", Number(e.target.value))} />
            </div>
            <div>
              <Label>高さ（%）</Label>
              <Input className="mt-1" type="number" min={3} max={90} value={form.height} onChange={(e) => set("height", Number(e.target.value))} />
            </div>
          </div>

          {/* Preview */}
          <div className="border border-border rounded-xl p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">プレビュー</p>
            <div className="relative bg-slate-100 rounded-lg" style={{ height: 80 }}>
              <div style={{
                position: "absolute",
                left: `${Math.min(form.x, 70)}%`,
                top: `${Math.min(form.y, 50)}%`,
                width: `${Math.min(form.width, 40)}%`,
                height: `${Math.min(form.height, 60)}%`,
                backgroundColor: form.color,
                borderRadius: form.type === "circle" ? "50%" : "6px",
                border: "2px solid rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <span className="text-[9px] font-semibold text-slate-600 px-1 text-center">{form.name || "エリア"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>閉じる</Button>
          {!area && (
            <Button className="flex-1" disabled={!form.name || mutation.isPending} onClick={() => mutation.mutate(form, {
              onSuccess: () => {
                toast.success("作成しました");
                setTimeout(onClose, 500);
              }
            })}>
              {mutation.isPending ? "作成中..." : "作成"}
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

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

  // Auto-save on form changes
  const prevFormRef = useRef(form);
  useEffect(() => {
    const timer = setTimeout(() => {
      const prev = prevFormRef.current;
      if (
        prev.name !== form.name ||
        prev.type !== form.type ||
        prev.x !== form.x ||
        prev.y !== form.y ||
        prev.width !== form.width ||
        prev.height !== form.height ||
        prev.color !== form.color
      ) {
        if (form.name) mutation.mutate(form);
        prevFormRef.current = form;
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [form]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
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
            <Select value={form.type} onValueChange={(v) => set("type", v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rectangle">長方形</SelectItem>
                <SelectItem value="circle">円形</SelectItem>
              </SelectContent>
            </Select>
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
          <Button className="flex-1" disabled={!form.name || mutation.isPending} onClick={() => { mutation.mutate(form); setTimeout(onClose, 500); }}>
            {mutation.isPending ? "保存中..." : "保存済み"}
          </Button>
        </div>
      </div>
    </div>
  );
}
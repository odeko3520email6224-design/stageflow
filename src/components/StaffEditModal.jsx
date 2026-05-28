import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PRESET_COLORS = [
  { label: "デフォルト", value: "" },
  { label: "赤", value: "#ef4444" },
  { label: "オレンジ", value: "#f97316" },
  { label: "黄", value: "#eab308" },
  { label: "緑", value: "#22c55e" },
  { label: "青", value: "#3b82f6" },
  { label: "紫", value: "#a855f7" },
  { label: "ピンク", value: "#ec4899" },
  { label: "白", value: "#ffffff" },
];

export default function StaffEditModal({ staff, onClose, onSaved }) {
  const [localName, setLocalName] = useState(staff.name);
  const [localNote, setLocalNote] = useState(staff.note || "");
  const [localColor, setLocalColor] = useState(staff.color || "");
  const prevDataRef = useRef({ name: staff.name, note: staff.note || "", color: staff.color || "" });
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke("updateStaffRecord", { action: "update", staffId: staff.id, data });
      return res?.data?.staff;
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["staff", staff.event_id] });
      await queryClient.cancelQueries({ queryKey: ["positions", staff.event_id] });
      const previousStaff = queryClient.getQueryData(["staff", staff.event_id]);
      const previousPositions = queryClient.getQueryData(["positions", staff.event_id]);
      queryClient.setQueryData(["staff", staff.event_id], (old = []) =>
        old.map((item) => item.id === staff.id ? { ...item, ...data } : item)
      );
      const previousName = prevDataRef.current.name;
      if (data.name && data.name !== previousName) {
        queryClient.setQueryData(["positions", staff.event_id], (old = []) =>
          old.map((position) => ({
            ...position,
            staff_names: (position.staff_names || []).map((name) => name === previousName ? data.name : name),
          }))
        );
      }
      return { previousStaff, previousPositions };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["staff", staff.event_id], context?.previousStaff);
      queryClient.setQueryData(["positions", staff.event_id], context?.previousPositions);
      toast.error("保存に失敗しました");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", staff.event_id] });
      queryClient.invalidateQueries({ queryKey: ["positions", staff.event_id] });
      onSaved?.();
    },
  });

  useEffect(() => {
    if (!localName.trim()) return;
    const prev = prevDataRef.current;
    if (localName === prev.name && localNote === prev.note && localColor === prev.color) return;
    const timer = setTimeout(() => {
      const nextData = { name: localName.trim(), note: localNote.trim(), color: localColor };
      updateMutation.mutate(nextData, {
        onSuccess: () => {
          toast.success("保存しました");
          prevDataRef.current = nextData;
        },
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [localName, localNote, localColor]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-2 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm p-5"
        initial={{ y: 32, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base">スタッフ編集</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="閉じる">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">スタッフ名</label>
            <Input value={localName} onChange={(e) => setLocalName(e.target.value)} className="mt-1" style={{ color: localColor || undefined }} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">備考</label>
            <Input value={localNote} onChange={(e) => setLocalNote(e.target.value)} placeholder="任意" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">表示文字色</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setLocalColor(c.value)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${localColor === c.value ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"}`}
                  title={c.label}
                >
                  <span
                    className="inline-block w-3 h-3 rounded-full border border-border/60"
                    style={{ backgroundColor: c.value || "transparent", outline: !c.value ? "1px dashed #aaa" : "none" }}
                  />
                  <span style={{ color: c.value || undefined }}>{c.label}</span>
                </button>
              ))}
              <div className="flex items-center gap-1 border border-border rounded-md px-2 py-1">
                <span className="text-xs text-muted-foreground">カスタム</span>
                <input
                  type="color"
                  value={localColor || "#000000"}
                  onChange={(e) => setLocalColor(e.target.value)}
                  className="w-6 h-5 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" size="sm" onClick={onClose}>閉じる</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
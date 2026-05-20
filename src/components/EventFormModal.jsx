import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { X } from "lucide-react";
import { motion } from "framer-motion";

export default function EventFormModal({ event, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: event?.name || "",
    date: event?.date || "",
    venue: event?.venue || "",
    description: event?.description || "",
    status: event?.status || "準備中",
  });

  const mutation = useMutation({
    mutationFn: (data) =>
      event
        ? base44.entities.Event.update(event.id, data)
        : base44.entities.Event.create(data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ["events"] });
      if (event) await queryClient.cancelQueries({ queryKey: ["event", event.id] });
      const previousEvents = queryClient.getQueryData(["events"]);
      const previousEvent = event ? queryClient.getQueryData(["event", event.id]) : undefined;
      const optimisticId = event?.id || `temp-event-${Date.now()}`;
      const optimisticEvent = { ...(event || {}), ...data, id: optimisticId };

      queryClient.setQueryData(["events"], (old = []) => {
        if (event) return old.map((item) => item.id === event.id ? { ...item, ...data } : item);
        return [optimisticEvent, ...old];
      });
      if (event) queryClient.setQueryData(["event", event.id], optimisticEvent);

      return { previousEvents, previousEvent, optimisticId };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["events"], context?.previousEvents);
      if (event) queryClient.setQueryData(["event", event.id], context?.previousEvent);
      toast.error(event ? "保存に失敗しました" : "作成に失敗しました");
    },
    onSuccess: (savedEvent, __, context) => {
      if (!event && savedEvent?.id) {
        queryClient.setQueryData(["events"], (old = []) =>
          old.map((item) => item.id === context?.optimisticId ? savedEvent : item)
        );
      }
      onSaved?.();
    },
  });

  // Auto-save: text fields (name, venue, description) → 500ms, others (date, status) → instant
  const prevFormRef = useRef(form);
  const isTextChange = (prev, cur) =>
    prev.name !== cur.name || prev.venue !== cur.venue || prev.description !== cur.description;
  const isNonTextChange = (prev, cur) =>
    prev.date !== cur.date || prev.status !== cur.status;

  useEffect(() => {
    if (!event || !form.name) return;
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

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md p-4 max-h-[92vh] overflow-y-auto"
        initial={{ y: 32, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">{event ? "イベント編集" : "新規イベント"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <Label>イベント名 *</Label>
            <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：〇〇コンサート2026" />
          </div>
          <div>
            <Label>開催日</Label>
            <Input
              className="mt-1"
              type="date"
              value={form.date}
              min="2000-01-01"
              max="2099-12-31"
              onChange={(e) => {
                const val = e.target.value;
                if (!val) { setForm({ ...form, date: "" }); return; }
                const year = parseInt(val.split("-")[0], 10);
                if (year >= 2000 && year <= 2099) {
                  setForm({ ...form, date: val });
                }
              }}
            />
          </div>
          <div>
            <Label>会場名</Label>
            <Input className="mt-1" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="例：〇〇アリーナ" />
          </div>
          <div>
            <Label>ステータス</Label>
            <ResponsiveSelect
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v })}
              options={[
                { value: "準備中", label: "準備中" },
                { value: "開催中", label: "開催中" },
                { value: "終了", label: "終了" },
              ]}
              placeholder="ステータスを選択"
           />
          </div>
          <div>
            <Label>備考</Label>
            <Input className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="メモなど" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>閉じる</Button>
          {!event && (
            <Button
              className="flex-1"
              disabled={!form.name || mutation.isPending}
              onClick={() => mutation.mutate(form, {
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
      </motion.div>
    </motion.div>
  );
}

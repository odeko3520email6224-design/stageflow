import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export default function EventFormModal({ event, onClose, onSaved }) {
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
    onSuccess: onSaved,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{event ? "イベント編集" : "新規イベント"}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <Label>イベント名 *</Label>
            <Input className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：〇〇コンサート2026" />
          </div>
          <div>
            <Label>開催日</Label>
            <Input className="mt-1" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <Label>会場名</Label>
            <Input className="mt-1" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} placeholder="例：〇〇アリーナ" />
          </div>
          <div>
            <Label>ステータス</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="準備中">準備中</SelectItem>
                <SelectItem value="開催中">開催中</SelectItem>
                <SelectItem value="終了">終了</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>備考</Label>
            <Input className="mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="メモなど" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose}>キャンセル</Button>
          <Button
            className="flex-1"
            disabled={!form.name || mutation.isPending}
            onClick={() => mutation.mutate(form)}
          >
            {mutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
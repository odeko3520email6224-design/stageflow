import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Users } from "lucide-react";

export default function StaffManagement({ eventId }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Staff.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", eventId] });
      setName("");
      setNote("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Staff.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff", eventId] }),
  });

  const handleAdd = () => {
    if (!name.trim()) return;
    createMutation.mutate({ event_id: eventId, name: name.trim(), note: note.trim() });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAdd(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">スタッフ管理</h2>
        <span className="text-sm text-muted-foreground">{staffList.length}名登録中</span>
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6">
        <p className="text-sm font-medium mb-3">スタッフを追加</p>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="スタッフ名"
            className="flex-1"
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="備考（任意）"
            className="flex-1"
          />
          <Button onClick={handleAdd} disabled={!name.trim() || createMutation.isPending} className="gap-1.5 shrink-0">
            <Plus className="w-4 h-4" />追加
          </Button>
        </div>
      </div>

      {/* Staff list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium">スタッフが登録されていません</p>
          <p className="text-sm mt-1">上のフォームからスタッフを追加してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {staffList.map((staff) => (
            <div key={staff.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {staff.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{staff.name}</p>
                {staff.note && <p className="text-xs text-muted-foreground truncate">{staff.note}</p>}
              </div>
              <button
                onClick={() => { if (confirm(`「${staff.name}」を削除しますか？`)) deleteMutation.mutate(staff.id); }}
                className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
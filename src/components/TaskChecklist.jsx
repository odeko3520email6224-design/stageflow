import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CheckSquare, Square, Plus, Trash2, Pencil, Check, X, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function TaskChecklist({ eventId }) {
  const queryClient = useQueryClient();
  // 連絡事項・チェックリストは全ロールに編集権限を付与
  const canEdit = true;

  const [newTitle, setNewTitle] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", eventId],
    queryFn: () => base44.entities.Task.filter({ event_id: eventId }, "order"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", eventId] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks", eventId] });
      const prev = queryClient.getQueryData(["tasks", eventId]);
      queryClient.setQueryData(["tasks", eventId], (old) =>
        old.map((t) => (t.id === id ? { ...t, ...data } : t))
      );
      return { prev };
    },
    onError: (_, __, ctx) => queryClient.setQueryData(["tasks", eventId], ctx.prev),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", eventId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks", eventId] }),
  });

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    createMutation.mutate({
      event_id: eventId,
      title: newTitle.trim(),
      note: newNote.trim(),
      is_done: false,
      order: tasks.length,
    });
    setNewTitle("");
    setNewNote("");
  };

  const handleToggle = (task) => {
    updateMutation.mutate({ id: task.id, data: { is_done: !task.is_done } });
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditNote(task.note || "");
  };

  const saveEdit = (task) => {
    if (!editTitle.trim()) return;
    updateMutation.mutate({ id: task.id, data: { title: editTitle.trim(), note: editNote.trim() } });
    setEditingId(null);
  };

  const done = tasks.filter((t) => t.is_done);
  const pending = tasks.filter((t) => !t.is_done);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-1 mb-2">
        <h2 className="text-sm font-bold flex items-center gap-1.5">
          <ClipboardCheck className="w-4 h-4 text-primary" />
          準備・残作業チェックリスト
        </h2>
        <p className="text-[11px] text-muted-foreground">
          {pending.length}件未完了 / {tasks.length}件中
        </p>
      </div>

      {/* 追加フォーム */}
      {canEdit && (
        <div className="mb-2 bg-card border border-border rounded-lg p-2 space-y-1.5">
          <Input
            placeholder="タスク名を入力..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="text-sm h-9"
          />
          <Input
            placeholder="備考（任意）"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="text-xs h-8"
          />
          <Button
            size="sm"
            className="w-full h-8 gap-1 text-xs"
            onClick={handleAdd}
            disabled={!newTitle.trim() || createMutation.isPending}
          >
            <Plus className="w-3.5 h-3.5" />
            追加
          </Button>
        </div>
      )}

      {/* 未完了 */}
      <div className="space-y-1 mb-2">
        {pending.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-3">未完了のタスクはありません</p>
        )}
        {pending.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            canEdit={canEdit}
            editingId={editingId}
            editTitle={editTitle}
            editNote={editNote}
            setEditTitle={setEditTitle}
            setEditNote={setEditNote}
            onToggle={handleToggle}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditingId(null)}
            onDelete={(t) => setConfirmDelete(t)}
          />
        ))}
      </div>

      {/* 完了済み */}
      {done.length > 0 && (
        <div>
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
            完了済み ({done.length})
          </div>
          <div className="space-y-1 opacity-60">
            {done.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                canEdit={canEdit}
                editingId={editingId}
                editTitle={editTitle}
                editNote={editNote}
                setEditTitle={setEditTitle}
                setEditNote={setEditNote}
                onToggle={handleToggle}
                onStartEdit={startEdit}
                onSaveEdit={saveEdit}
                onCancelEdit={() => setEditingId(null)}
                onDelete={(t) => setConfirmDelete(t)}
              />
            ))}
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          message={`「${confirmDelete.title}」を削除しますか？`}
          confirmLabel="削除"
          onConfirm={() => { deleteMutation.mutate(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

function TaskRow({ task, canEdit, editingId, editTitle, editNote, setEditTitle, setEditNote, onToggle, onStartEdit, onSaveEdit, onCancelEdit, onDelete }) {
  const isEditing = editingId === task.id;

  return (
    <div className={`flex items-start gap-2 bg-card border rounded-lg px-2.5 py-1.5 ${task.is_done ? "border-border" : "border-border"}`}>
      <button
        onClick={() => onToggle(task)}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
      >
        {task.is_done
          ? <CheckSquare className="w-5 h-5 text-primary" />
          : <Square className="w-5 h-5" />
        }
      </button>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-1.5">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(task); if (e.key === "Escape") onCancelEdit(); }}
              className="text-sm h-8"
              autoFocus
            />
            <Input
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveEdit(task); if (e.key === "Escape") onCancelEdit(); }}
              placeholder="備考（任意）"
              className="text-xs h-7"
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 px-2 text-[10px] gap-0.5" onClick={() => onSaveEdit(task)}>
                <Check className="w-3 h-3" />保存
              </Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-0.5" onClick={onCancelEdit}>
                <X className="w-3 h-3" />キャンセル
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className={`text-sm font-medium leading-snug ${task.is_done ? "line-through text-muted-foreground" : ""}`}>
              {task.title}
            </p>
            {task.note && <p className="text-[11px] text-muted-foreground mt-0.5">{task.note}</p>}
          </>
        )}
      </div>

      {canEdit && !isEditing && (
        <div className="flex gap-0.5 shrink-0">
          <button onClick={() => onStartEdit(task)} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(task)} className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

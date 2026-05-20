import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, X } from "lucide-react";
import { toast } from "sonner";

export function getUserDisplayName(user) {
  return user?.username || user?.full_name || user?.email || "";
}

export default function UserNameEditor({ user, onSaved }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(user?.username || "");

  const updateMutation = useMutation({
    mutationFn: (name) => base44.entities.User.update(user.id, { username: name }),
    onSuccess: (updatedUser) => {
      const nextUser = { ...user, ...(updatedUser || {}), username: username.trim() };
      onSaved?.(nextUser);
      toast.success("ユーザー名を保存しました");
      setOpen(false);
    },
    onError: () => {
      toast.error("ユーザー名の保存に失敗しました");
    },
  });

  const handleOpen = () => {
    setUsername(user?.username || "");
    setOpen(true);
  };

  const handleSave = () => {
    const name = username.trim();
    if (!name) return;
    updateMutation.mutate(name);
  };

  if (!user?.id) return null;

  return (
    <>
      <button
        onClick={handleOpen}
        className="p-0.5 rounded text-muted-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
        title="ユーザー名を編集"
        aria-label="ユーザー名を編集"
      >
        <Pencil className="w-3 h-3" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">ユーザー名を登録</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted text-muted-foreground" aria-label="閉じる">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSave();
                }}
                placeholder="表示するユーザー名"
                className="h-9 text-sm"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">この名前はアプリ内の表示名として使用されます。</p>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(false)}>
                キャンセル
              </Button>
              <Button size="sm" className="flex-1" onClick={handleSave} disabled={!username.trim() || updateMutation.isPending}>
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

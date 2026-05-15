import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin, ChevronRight, Trash2, Pencil, LogOut, User } from "lucide-react";
import EventFormModal from "@/components/EventFormModal";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const statusColor = {
  "準備中": "bg-amber-100 text-amber-700 border-amber-200",
  "開催中": "bg-green-100 text-green-700 border-green-200",
  "終了": "bg-slate-100 text-slate-500 border-slate-200",
};

export default function Events() {
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();
  const { canEdit } = useUserRole();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-created_date"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] }),
  });

  const handleEdit = (e, event) => {
    e.preventDefault();
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleDelete = (e, id) => {
    e.preventDefault();
    if (confirm("このイベントを削除しますか？")) deleteMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">イベント一覧</h1>
          <p className="text-muted-foreground text-[10px]">イベントを選択して配置管理</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setEditingEvent(null); setShowModal(true); }} className="gap-1" size="sm" disabled={!canEdit}>
            <Plus className="w-3.5 h-3.5" />
            新規
          </Button>
          {currentUser && (
            <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-3 h-3 text-primary" />
              </div>
              <div className="text-right">
                <div className="text-xs font-medium leading-none">{currentUser.full_name || currentUser.email}</div>
                {currentUser.full_name && <div className="text-[10px] text-muted-foreground leading-none mt-0.5">{currentUser.email}</div>}
              </div>
              <button
                onClick={() => base44.auth.logout()}
                className="ml-1 p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                title="ログアウト"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Calendar className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">イベントがありません</p>
            <p className="text-sm mt-1">新規イベントを追加してください</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {events.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group block bg-card border border-border rounded-xl px-3 py-2.5 hover:border-primary/40 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h2 className="text-sm font-semibold text-foreground truncate">{event.name}</h2>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${statusColor[event.status]}`}>
                        {event.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {event.date && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {format(new Date(event.date), "M月d日（E）", { locale: ja })}
                        </span>
                      )}
                      {event.venue && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {event.venue}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => handleEdit(e, event)}
                      disabled={!canEdit}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, event.id)}
                      disabled={!canEdit}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <EventFormModal
          event={editingEvent}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["events"] });
          }}
        />
      )}
    </div>
  );
}
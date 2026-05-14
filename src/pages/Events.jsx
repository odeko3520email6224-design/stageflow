import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MapPin, ChevronRight, Trash2, Pencil } from "lucide-react";
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
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();

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
      <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">イベント一覧</h1>
          <p className="text-muted-foreground mt-0.5 text-xs">コンサート・イベントを選択して配置管理を行います</p>
        </div>
        <Button onClick={() => { setEditingEvent(null); setShowModal(true); }} className="gap-1.5" size="sm" disabled={!isAdmin}>
          <Plus className="w-4 h-4" />
          新規イベント
        </Button>
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
          <div className="grid gap-4">
            {events.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="group block bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-semibold text-foreground truncate">{event.name}</h2>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${statusColor[event.status]}`}>
                        {event.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {event.date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(event.date), "yyyy年M月d日（E）", { locale: ja })}
                        </span>
                      )}
                      {event.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.venue}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleEdit(e, event)}
                      disabled={!isAdmin}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, event.id)}
                      disabled={!isAdmin}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
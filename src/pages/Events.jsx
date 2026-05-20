import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, MapPin, ChevronRight, Trash2, Pencil, LogOut, User } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import { motion } from "framer-motion";
import EventFormModal from "@/components/EventFormModal";
import UserNameEditor, { getUserDisplayName } from "@/components/UserNameEditor";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

const statusColor = {
  "準備中": "bg-amber-100 text-amber-700 border-amber-200",
  "開催中": "bg-green-100 text-green-700 border-green-200",
  "終了": "bg-slate-100 text-slate-500 border-slate-200"
};

export default function Events() {
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();
  const { canEdit } = useUserRole();

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: () => base44.entities.Event.list("-created_date")
  });

  const { isPulling, pullDistance } = usePullToRefresh(async () => {
    await refetch();
  });

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Event.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events"] })
  });

  const handleEdit = (e, event) => {
    e.preventDefault();
    setEditingEvent(event);
    setShowModal(true);
  };

  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState(null);

  const handleDelete = (e, id, name) => {
    e.preventDefault();
    setConfirmDeleteEvent({ id, name });
  };

  return (
    <div className="min-h-screen bg-background safe-area-top safe-area-bottom relative scrollbar-hide overflow-x-hidden">
      {/* Pull-to-refresh indicator */}
      {isPulling &&
      <div className="fixed top-0 left-0 right-0 flex justify-center pt-2 z-30">
          <div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" style={{ opacity: pullDistance / 100 }} />
        </div>
      }
      <div className="max-w-5xl mx-auto px-2 py-2 pb-16 sm:pb-2">
      {/* Header */}
      <div className="mb-2">
        {/* Row 1: Title */}
        <div className="mb-1">
          <h1 className="text-base font-bold text-foreground tracking-tight">イベント一覧</h1>
          <p className="text-muted-foreground text-[10px]">イベント・コンサートの配置管理を行うアプリケーションです
スマートフォンやタブレット、パソコンからご利用いただけます</p>
        </div>
        {/* Row 2: New button + Account */}
        <div className="flex items-center justify-between gap-1.5">
          <Button onClick={() => {setEditingEvent(null);setShowModal(true);}} className="gap-1 select-none" size="sm" disabled={!canEdit}>
            <Plus className="w-3.5 h-3.5" />
            新規
          </Button>
          {currentUser && <div className="flex items-center gap-1.5 bg-muted rounded-md px-1.5 py-0.5 min-w-0 group">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <User className="w-3 h-3 text-primary" />
              </div>
              <div className="text-right min-w-0">
                <div className="text-xs font-medium leading-none truncate">{getUserDisplayName(currentUser)}</div>
                {getUserDisplayName(currentUser) !== currentUser.email && <div className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">{currentUser.email}</div>}
              </div>
              <div className="ml-1 flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <UserNameEditor user={currentUser} onSaved={setCurrentUser} />
                <button
                onClick={() => setConfirmDeleteEvent({ id: "__account__", name: "アカウント（ログアウトします）" })}
                className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
                title="アカウント削除">
                <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => base44.auth.logout()}
                  className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
                  title="ログアウト">
                  
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            </div>
            }
        </div>
      </div>

        {isLoading ?
        <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div> :
        events.length === 0 ?
        <div className="text-center py-24 text-muted-foreground">
            <Calendar className="w-14 h-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">イベントがありません</p>
            <p className="text-sm mt-1">新規イベントを追加してください</p>
          </div> :

        <motion.div
          className="grid gap-2"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}>
          
            {events.map((event) =>
          <Link
            key={event.id}
            to={`/events/${event.id}`}
            className="group block bg-card border border-border rounded-lg px-2.5 py-1.5 hover:border-primary/40 hover:shadow-sm transition-all duration-200">
            
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h2 className="text-sm font-semibold text-foreground truncate">{event.name}</h2>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0 ${statusColor[event.status]}`}>
                        {event.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {event.date &&
                  <span className="flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" />
                          {format(new Date(event.date), "M月d日（E）", { locale: ja })}
                        </span>
                  }
                      {event.venue &&
                  <span className="flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {event.venue}
                        </span>
                  }
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                  onClick={(e) => handleEdit(e, event)}
                  disabled={!canEdit}
                  className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:pointer-events-none select-none">
                  
                       <Pencil className="w-3 h-3" />
                     </button>
                     <button
                     onClick={(e) => handleDelete(e, event.id, event.name)}
                     disabled={!canEdit}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:pointer-events-none select-none">
                  
                       <Trash2 className="w-3 h-3" />
                     </button>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Link>
          )}
          </motion.div>
        }
      </div>

      {confirmDeleteEvent && (
        <ConfirmDialog
          message={confirmDeleteEvent.id === "__account__"
            ? "ログアウトしますか？"
            : `「${confirmDeleteEvent.name}」を削除しますか？`}
          confirmLabel={confirmDeleteEvent.id === "__account__" ? "ログアウト" : "削除"}
          confirmVariant={confirmDeleteEvent.id === "__account__" ? "default" : "destructive"}
          onConfirm={() => {
            if (confirmDeleteEvent.id === "__account__") {
              base44.auth.logout();
            } else {
              deleteMutation.mutate(confirmDeleteEvent.id);
            }
            setConfirmDeleteEvent(null);
          }}
          onCancel={() => setConfirmDeleteEvent(null)}
        />
      )}

      {showModal &&
      <EventFormModal
        event={editingEvent}
        onClose={() => setShowModal(false)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["events"] });
        }} />

      }
    </div>);

}

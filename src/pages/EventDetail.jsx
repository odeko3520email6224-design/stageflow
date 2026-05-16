import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, User, LogOut, Users, ClipboardList, MapPin, Clock, Bell, Settings } from "lucide-react";
import { motion } from "framer-motion";
import VenueMap from "@/components/VenueMap";
import StaffManagement from "@/components/StaffManagement";
import PositionTypeManagement from "@/components/PositionTypeManagement";
import StaffTimeline from "@/components/StaffTimeline";
import AnnouncementManager from "@/components/AnnouncementManager";
import AnnouncementAlert from "@/components/AnnouncementAlert";
import StaffDragDropManager from "@/components/StaffDragDropManager";
import BottomTabBar from "@/components/BottomTabBar";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import { useTabNavigation } from "@/hooks/useTabNavigation";

export default function EventDetail() {
  const { eventId } = useParams();
  const [tab, setTab] = useTabNavigation("staff");

  const { isAdmin, canManageSettings } = useUserRole();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: event, isLoading, refetch: refetchEvent } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }),
    select: (d) => d[0],
  });

  const { isPulling, pullDistance } = usePullToRefresh(async () => {
    await refetchEvent();
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) return <div className="p-8 text-muted-foreground">イベントが見つかりません</div>;



  return (
    <div className="min-h-screen bg-background relative">
      {/* Pull-to-refresh indicator */}
      {isPulling && (
        <div className="fixed top-0 left-0 right-0 flex justify-center pt-2 z-30">
          <div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" style={{ opacity: pullDistance / 100 }} />
        </div>
      )}

      {/* Alert Banner */}
      <AnnouncementAlert eventId={eventId} />

      {/* Top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-50 pt-4 safe-area-top">
        {/* Row 1: back + event name + user */}
        <div className="max-w-6xl mx-auto px-3 pb-2 pt-1 flex items-center gap-2">
          <Link to="/" className="relative z-[100] p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0" aria-label="戻る">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base leading-snug truncate">{event.name}</h1>
            {(event.date || event.venue) && (
              <div className="text-xs text-muted-foreground leading-snug mt-0.5">
                {event.date && format(new Date(event.date), "M月d日（E）", { locale: ja })}
                {event.venue && `　${event.venue}`}
              </div>
            )}
          </div>
          {currentUser && (
            <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1 shrink-0">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-3 h-3 text-primary" />
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-medium leading-none">{currentUser.full_name || currentUser.email}</div>
                {currentUser.full_name && <div className="text-[10px] text-muted-foreground leading-none mt-0.5">{currentUser.email}</div>}
              </div>
              <button
                onClick={() => base44.auth.logout()}
                className="ml-1 p-1 rounded text-muted-foreground hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="ログアウト"
                aria-label="ログアウト"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Tab Navigation */}
      <div className="hidden sm:block border-b border-border bg-white dark:bg-card">
        <div className="max-w-6xl mx-auto px-3">
          <div className="flex gap-5">
            {[
              { id: "staff", label: "スタッフ管理", icon: Users },
              { id: "dragdrop", label: "配置表", icon: ClipboardList },
              { id: "map", label: "会場マップ", icon: MapPin },
              { id: "timeline", label: "タイムライン", icon: Clock },
              { id: "notice", label: "連絡事項", icon: Bell },
              { id: "admin", label: "管理", icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 select-none will-change-auto ${
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                aria-current={tab === id ? "page" : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-2 py-2 pb-24 sm:pb-12">
        <motion.div
          key={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "staff" && <StaffManagement eventId={eventId} />}
          {tab === "dragdrop" && <StaffDragDropManager eventId={eventId} />}
          {tab === "admin" && <PositionTypeManagement eventId={eventId} />}
          {tab === "map" && <VenueMap eventId={eventId} />}
          {tab === "timeline" && <StaffTimeline eventId={eventId} />}
          {tab === "notice" && <AnnouncementManager eventId={eventId} />}
        </motion.div>
      </div>

      {/* Bottom Tab Navigation - Mobile Only */}
      <div className="sm:hidden">
        <BottomTabBar activeTab={tab} onTabChange={setTab} />
      </div>
    </div>
  );
}
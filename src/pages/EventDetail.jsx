import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, List, Map, Users, Settings, Clock, Megaphone, User, LogOut } from "lucide-react";
import VenueMap from "@/components/VenueMap";
import StaffManagement from "@/components/StaffManagement";
import PositionTypeManagement from "@/components/PositionTypeManagement";
import StaffTimeline from "@/components/StaffTimeline";
import AnnouncementManager from "@/components/AnnouncementManager";
import AnnouncementAlert from "@/components/AnnouncementAlert";
import StaffDragDropManager from "@/components/StaffDragDropManager";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";

export default function EventDetail() {
  const { eventId } = useParams();
  const [tab, setTab] = useState("staff");

  const { isAdmin, canManageSettings } = useUserRole();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }),
    select: (d) => d[0],
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) return <div className="p-8 text-muted-foreground">イベントが見つかりません</div>;

  const TABS = [
    { id: "staff", label: "スタッフ管理", icon: Users },
    { id: "dragdrop", label: "配置表", icon: List },
    { id: "map", label: "会場マップ", icon: Map },
    { id: "timeline", label: "タイムライン", icon: Clock },
    { id: "notice", label: "連絡", icon: Megaphone },
    ...(canManageSettings ? [{ id: "admin", label: "設定", icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Alert Banner */}
      <AnnouncementAlert eventId={eventId} />

      {/* Top bar - 2 rows */}
      <div className="bg-card border-b border-border sticky top-0 z-50">
        {/* Row 1: back + event name + user */}
        <div className="max-w-6xl mx-auto px-3 pt-2 pb-1 flex items-center gap-2">
          <Link to="/" className="relative z-[100] p-1 rounded-lg hover:bg-muted transition-colors shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-base leading-tight truncate">{event.name}</h1>
            {(event.date || event.venue) && (
              <div className="text-[10px] text-muted-foreground leading-tight">
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
                className="ml-1 p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                title="ログアウト"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        {/* Row 2: tabs */}
        <div className="max-w-6xl mx-auto px-1 pb-0 overflow-x-auto scrollbar-hide">
          <div className="flex gap-0 border-b border-border -mb-px min-w-max">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-0.5 px-2 py-1.5 text-[11px] font-medium border-b-2 transition-all whitespace-nowrap ${
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-2 py-2 pb-12">
        {tab === "staff" && <StaffManagement eventId={eventId} />}
        {tab === "dragdrop" && <StaffDragDropManager eventId={eventId} />}
        {tab === "admin" && <PositionTypeManagement eventId={eventId} />}
        {tab === "map" && <VenueMap eventId={eventId} />}
        {tab === "timeline" && <StaffTimeline eventId={eventId} />}
        {tab === "notice" && <AnnouncementManager eventId={eventId} />}
      </div>
    </div>
  );
}
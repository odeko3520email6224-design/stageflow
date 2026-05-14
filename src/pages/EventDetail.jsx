import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, List, Map, Users, Settings, Clock, Megaphone } from "lucide-react";
import StaffList from "@/components/StaffList";
import VenueMap from "@/components/VenueMap";
import StaffManagement from "@/components/StaffManagement";
import PositionTypeManagement from "@/components/PositionTypeManagement";
import StaffTimeline from "@/components/StaffTimeline";
import AnnouncementManager from "@/components/AnnouncementManager";
import AnnouncementAlert from "@/components/AnnouncementAlert";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function EventDetail() {
  const { eventId } = useParams();
  const [tab, setTab] = useState("list");

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
    { id: "list", label: "配置表", icon: List },
    { id: "map", label: "会場マップ", icon: Map },
    { id: "timeline", label: "タイムライン", icon: Clock },
    { id: "notice", label: "連絡", icon: Megaphone },
    { id: "admin", label: "管理", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Alert Banner */}
      <AnnouncementAlert eventId={eventId} />

      {/* Top bar - 2 rows */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        {/* Row 1: back + event name */}
        <div className="max-w-6xl mx-auto px-4 pt-3 pb-2 flex items-center gap-3">
          <Link to="/" className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">{event.name}</h1>
            <div className="text-xs text-muted-foreground">
              {event.date && format(new Date(event.date), "yyyy年M月d日（E）", { locale: ja })}
              {event.venue && `　${event.venue}`}
            </div>
          </div>
        </div>
        {/* Row 2: tabs */}
        <div className="max-w-6xl mx-auto px-2 pb-0 overflow-x-auto">
          <div className="flex gap-0 border-b border-border -mb-px min-w-max">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {tab === "staff" && <StaffManagement eventId={eventId} />}
        {tab === "admin" && <PositionTypeManagement eventId={eventId} />}
        {tab === "list" && <StaffList eventId={eventId} />}
        {tab === "map" && <VenueMap eventId={eventId} />}
        {tab === "timeline" && <StaffTimeline eventId={eventId} />}
        {tab === "notice" && <AnnouncementManager eventId={eventId} />}
      </div>
    </div>
  );
}
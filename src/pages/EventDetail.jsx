import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, List, Map } from "lucide-react";
import StaffList from "@/components/StaffList";
import VenueMap from "@/components/VenueMap";
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

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg leading-tight truncate">{event.name}</h1>
            <div className="text-xs text-muted-foreground">
              {event.date && format(new Date(event.date), "yyyy年M月d日（E）", { locale: ja })}
              {event.venue && `　${event.venue}`}
            </div>
          </div>
          {/* Tab switcher */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setTab("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "list" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="w-4 h-4" />配置表
            </button>
            <button
              onClick={() => setTab("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "map" ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Map className="w-4 h-4" />会場マップ
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {tab === "list" ? (
          <StaffList eventId={eventId} />
        ) : (
          <VenueMap eventId={eventId} />
        )}
      </div>
    </div>
  );
}
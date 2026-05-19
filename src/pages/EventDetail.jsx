import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, User, LogOut, Users, ClipboardList, MapPin, Clock, Bell, Settings, CheckSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import VenueMap from "@/components/VenueMap";
import StaffManagement from "@/components/StaffManagement";
import PositionTypeManagement from "@/components/PositionTypeManagement";
import StaffTimeline from "@/components/StaffTimeline";
import AnnouncementManager from "@/components/AnnouncementManager";
import TaskChecklist from "@/components/TaskChecklist";
import AnnouncementAlert from "@/components/AnnouncementAlert";
import StaffDragDropManager from "@/components/StaffDragDropManager";
import BottomTabBar from "@/components/BottomTabBar";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { useUserRole } from "@/hooks/useUserRole";
import { useTabNavigation } from "@/hooks/useTabNavigation";
import { useAuth } from "@/lib/AuthContext";

const TIMELINE_STORAGE_KEY = "stageflow_timeline_enabled";

const tabVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export default function EventDetail() {
  const { eventId } = useParams();
  const [tab, setTab] = useTabNavigation("staff");

  const { isAdmin, isChief, canEdit, canManageSettings, role } = useUserRole();
  const isPrivileged = isAdmin || isChief;
  const { isAuthenticated, authChecked } = useAuth();
  const [currentUser, setCurrentUser] = useState(null);

  // Timeline feature toggle (persisted in localStorage, default OFF)
  const [showTimeline, setShowTimeline] = useState(() => {
    try {
      return localStorage.getItem(TIMELINE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const handleToggleTimeline = (val) => {
    setShowTimeline(val);
    try { localStorage.setItem(TIMELINE_STORAGE_KEY, String(val)); } catch {}
    // If currently on timeline tab and disabling, switch to staff
    if (!val && tab === "timeline") setTab("staff");
  };

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: event, isLoading, refetch: refetchEvent } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const response = await base44.functions.invoke("publicEvents", { action: "get", eventId });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data?.event;
    },
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

  // userロールは閲覧専用タブのみ表示
  const desktopTabs = [
    { id: "staff", label: "スタッフ管理", icon: Users },
    { id: "dragdrop", label: "配置表", icon: ClipboardList },
    { id: "map", label: "会場マップ", icon: MapPin },
    ...(showTimeline ? [{ id: "timeline", label: "タイムライン", icon: Clock }] : []),
    { id: "notice", label: "連絡事項", icon: Bell },
    { id: "tasks", label: "チェックリスト", icon: CheckSquare },
    ...(isPrivileged ? [{ id: "admin", label: "管理", icon: Settings }] : []),
  ];

  return (
    <div className="min-h-screen bg-background relative scrollbar-hide overflow-x-hidden">
      {isPulling && (
        <div className="fixed top-0 left-0 right-0 flex justify-center pt-2 z-30">
          <div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" style={{ opacity: pullDistance / 100 }} />
        </div>
      )}

      <AnnouncementAlert eventId={eventId} />

      {authChecked && !isAuthenticated && (
        <div className="border-b border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="max-w-6xl mx-auto px-3 py-2 text-xs leading-relaxed">
            <div className="font-bold">未ログインにつき、機能制限中</div>
            <div>・各種編集、管理機能を禁止</div>
            <div>・不正アクセス管理を有効化</div>
            <div>※不用意にこのURLを共有しないでください</div>
            <div className="pl-3">すべてのアクセスは記録、管理されています</div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="bg-card border-b border-border sticky top-0 z-50 safe-area-top">
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
                className="ml-1 p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                title="ログアウト"
                aria-label="ログアウト"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Desktop tab bar */}
        <div className="hidden sm:block border-t border-border">
          <div className="max-w-6xl mx-auto px-3">
            <div className="flex gap-5 overflow-x-auto scrollbar-hide">
              {desktopTabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap transition-colors focus-visible:outline-none select-none shrink-0 ${
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
      </div>

      <div className="max-w-6xl mx-auto px-2 py-2 pb-20 sm:pb-12">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            variants={tabVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {tab === "staff" && <StaffManagement eventId={eventId} isLoggedIn={isAuthenticated} />}
            {tab === "dragdrop" && <StaffDragDropManager eventId={eventId} />}
            {tab === "admin" && (
              <PositionTypeManagement
                eventId={eventId}
                showTimeline={showTimeline}
                onToggleTimeline={handleToggleTimeline}
              />
            )}
            {tab === "map" && <VenueMap eventId={eventId} />}
            {tab === "timeline" && showTimeline && <StaffTimeline eventId={eventId} />}
            {tab === "notice" && <AnnouncementManager eventId={eventId} />}
            {tab === "tasks" && <TaskChecklist eventId={eventId} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Tab Navigation - Mobile Only */}
      <div className="sm:hidden">
        <BottomTabBar activeTab={tab} onTabChange={setTab} showTimeline={showTimeline} isPrivileged={isPrivileged} />
      </div>
    </div>
  );
}

import { Users, Map, Clock, Megaphone, ClipboardList, Settings, CheckSquare } from "lucide-react";

const ALL_TABS = [
  { id: "staff", label: "スタッフ", icon: Users },
  { id: "dragdrop", label: "配置表", icon: ClipboardList },
  { id: "map", label: "マップ", icon: Map },
  { id: "timeline", label: "タイムライン", icon: Clock },
  { id: "notice", label: "連絡事項", icon: Megaphone },
  { id: "tasks", label: "チェックリスト", icon: CheckSquare },
  { id: "admin", label: "管理", icon: Settings },
];

export default function BottomTabBar({ activeTab, onTabChange, onActiveTabReset, showTimeline = false, showMap = false, showTasks = true, isPrivileged = true }) {
  const TABS = ALL_TABS.filter((t) => {
    if (t.id === "timeline" && !showTimeline) return false;
    if (t.id === "map" && !showMap) return false;
    if (t.id === "tasks" && !showTasks) return false;
    if (!isPrivileged && t.id === "admin") return false;
    return true;
  });

  const handleTabClick = (tabId) => {
    if (activeTab === tabId) {
      onActiveTabReset?.(tabId);
      onTabChange(tabId, { replace: true, reset: true });
      return;
    }
    onTabChange(tabId);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 safe-area-bottom">
      <div className="flex items-stretch justify-around min-h-14">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className={`flex min-w-0 flex-col items-center justify-center flex-1 gap-0.5 px-0.5 py-1 transition-colors focus-visible:outline-none select-none ${
              activeTab === id ? "text-primary" : "text-muted-foreground"
            }`}
            aria-current={activeTab === id ? "page" : undefined}
            aria-label={label}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="max-w-full truncate text-[11px] font-medium leading-none">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
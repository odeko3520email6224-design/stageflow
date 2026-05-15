import { Users, Map, Clock, Megaphone, ClipboardList, Settings } from "lucide-react";

const TABS = [
  { id: "staff", label: "スタッフ", icon: Users },
  { id: "dragdrop", label: "配置表", icon: ClipboardList },
  { id: "map", label: "マップ", icon: Map },
  { id: "timeline", label: "タイムライン", icon: Clock },
  { id: "notice", label: "連絡事項", icon: Megaphone },
  { id: "admin", label: "管理", icon: Settings },
];

export default function BottomTabBar({ activeTab, onTabChange }) {
  const handleTabClick = (tabId) => {
    if (activeTab === tabId) {
      // Reset search parameters when clicking active tab
      window.history.pushState({}, "", window.location.pathname);
    }
    onTabChange(tabId);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around h-16 z-40 safe-area-bottom">
      {TABS.map(({ id, label, icon: Icon }) => {
        const IconComponent = Icon;
        return (
          <button
            key={id}
            onClick={() => handleTabClick(id)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors focus-visible:outline-none focus-visible:ring-inset focus-visible:ring-2 focus-visible:ring-primary select-none ${
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            aria-current={activeTab === id ? "page" : undefined}
            aria-label={label}
          >
            <IconComponent className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
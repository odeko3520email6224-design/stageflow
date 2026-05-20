import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Settings, Moon, Sun, GripVertical, Clock, Bug, Wand2, Loader2, AlertTriangle } from "lucide-react";
import MapTemplateManagement from "@/components/MapTemplateManagement";
import PositionPresetManager from "@/components/PositionPresetManager";
import { useUserRole } from "@/hooks/useUserRole";
import { useTheme } from "@/lib/ThemeProvider";
import ConfirmDialog from "@/components/ConfirmDialog";

const PRESET_COLORS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#06b6d4", "#f97316",
];

export default function PositionTypeManagement({ eventId, showTimeline = false, onToggleTimeline }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmAutoPlace, setConfirmAutoPlace] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [localDebugEnabled, setLocalDebugEnabled] = useState(null);
  const queryClient = useQueryClient();
  const { canEdit: isAdmin } = useUserRole();
  const { isDark, setIsDark } = useTheme();

  const debugStorageKey = `stageflow:debug-enabled:${eventId}`;

  const { data: positionTypes = [], isLoading } = useQuery({
    queryKey: ["positionTypes"],
    queryFn: () => base44.entities.PositionType.list(),
    select: (d) => [...d].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => base44.entities.Event.filter({ id: eventId }),
    select: (d) => d[0],
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }),
  });

  useEffect(() => {
    const saved = window.localStorage.getItem(debugStorageKey);
    setLocalDebugEnabled(saved === null ? null : saved === "true");
  }, [debugStorageKey]);

  useEffect(() => {
    if (window.localStorage.getItem(debugStorageKey) === null && typeof event?.debug_enabled === "boolean") {
      setLocalDebugEnabled(event.debug_enabled);
      window.localStorage.setItem(debugStorageKey, String(event.debug_enabled));
    }
  }, [debugStorageKey, event?.debug_enabled]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PositionType.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positionTypes"] });
      setName("");
      setColor(PRESET_COLORS[0]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PositionType.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positionTypes"] });
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    },
  });

  const toggleDebugMutation = useMutation({
    mutationFn: async (debug_enabled) => {
      const response = await base44.functions.invoke("debugTools", {
        action: "setDebugEnabled",
        eventId: event?.id || eventId,
        debug_enabled,
      });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data?.event;
    },
    onMutate: async (debug_enabled) => {
      const previousLocalDebugEnabled = localDebugEnabled;
      setLocalDebugEnabled(debug_enabled);
      window.localStorage.setItem(debugStorageKey, String(debug_enabled));
      await queryClient.cancelQueries({ queryKey: ["event", eventId] });
      const previousEvent = queryClient.getQueryData(["event", eventId]);
      queryClient.setQueryData(["event", eventId], (old) => {
        if (Array.isArray(old)) {
          return old.map((item) => item.id === (event?.id || eventId) ? { ...item, debug_enabled } : item);
        }
        return old ? { ...old, debug_enabled } : old;
      });
      return { previousEvent, previousLocalDebugEnabled };
    },
    onError: (_, __, context) => {
      const previousDebugEnabled = context?.previousLocalDebugEnabled ??
        Boolean(context?.previousEvent?.[0]?.debug_enabled ?? context?.previousEvent?.debug_enabled);
      setLocalDebugEnabled(previousDebugEnabled);
      window.localStorage.setItem(debugStorageKey, String(previousDebugEnabled));
      queryClient.setQueryData(["event", eventId], context?.previousEvent);
      toast.error("デバッグ設定の保存に失敗しました");
    },
    onSuccess: (_, debug_enabled) => {
      setLocalDebugEnabled(debug_enabled);
      window.localStorage.setItem(debugStorageKey, String(debug_enabled));
      toast.success(debug_enabled ? "デバッグ機能をONにしました" : "デバッグ機能をOFFにしました");
    },
  });

  const autoPlaceMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke("debugTools", {
        action: "autoPlace",
        eventId: event?.id || eventId,
        debug_enabled: localDebugEnabled,
      });
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onError: (error) => {
      toast.error(error.message || "自動配置に失敗しました");
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
      toast.success(`自動配置しました（作成${result.created}件・更新${result.updated}件）`);
    },
  });

  const handleAdd = () => {
    if (!name.trim()) return;
    const maxOrder = positionTypes.length > 0 ? Math.max(...positionTypes.map((p) => p.order ?? 0)) : -1;
    createMutation.mutate({
      name: name.trim(),
      color,
      required_count: 0,
      required_count_before: 0,
      required_count_during: 0,
      required_count_after: 0,
      split_by_side: false,
      order: maxOrder + 1,
    });
  };

  const handleToggleSplitBySide = (positionType, splitBySide) => {
    queryClient.setQueryData(["positionTypes"], (old = []) =>
      old.map((pt) => pt.id === positionType.id ? { ...pt, split_by_side: splitBySide } : pt)
    );
    const matchingPositions = positions.filter((position) => position.name === positionType.name);
    queryClient.setQueryData(["positions", eventId], (old = []) =>
      old.map((position) => position.name === positionType.name
        ? {
            ...position,
            split_by_side: splitBySide,
            staff_names_kamite: position.staff_names_kamite || [],
            staff_names_shimote: position.staff_names_shimote || [],
          }
        : position)
    );
    Promise.all([
      base44.entities.PositionType.update(positionType.id, { split_by_side: splitBySide }),
      ...matchingPositions.map((position) => base44.entities.Position.update(position.id, {
        split_by_side: splitBySide,
        staff_names_kamite: position.staff_names_kamite || [],
        staff_names_shimote: position.staff_names_shimote || [],
        staff_names: splitBySide
          ? [...new Set([...(position.staff_names_kamite || []), ...(position.staff_names_shimote || []), ...(position.staff_names || [])])]
          : position.staff_names || [],
      })),
    ])
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["positionTypes"] });
        queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
      })
      .catch(() => {
        queryClient.invalidateQueries({ queryKey: ["positionTypes"] });
        queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
        toast.error("\u4e0a\u624b\u30fb\u4e0b\u624b\u8a2d\u5b9a\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f");
      });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); handleAdd(); }
  };

  const handleDragStart = (e, id) => { setDraggingId(id); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e, id) => { e.preventDefault(); if (id !== draggingId) setDragOverId(id); };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { setDraggingId(null); setDragOverId(null); return; }
    const fromIdx = positionTypes.findIndex((p) => p.id === draggingId);
    const toIdx = positionTypes.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) { setDraggingId(null); setDragOverId(null); return; }
    const reordered = [...positionTypes];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    reordered.forEach((pt, idx) => { base44.entities.PositionType.update(pt.id, { order: idx }); });
    queryClient.setQueryData(["positionTypes"], reordered.map((pt, idx) => ({ ...pt, order: idx })));
    setDraggingId(null); setDragOverId(null);
  };

  const debugEnabled = Boolean(localDebugEnabled ?? event?.debug_enabled);
  const canAutoPlace = isAdmin && debugEnabled && positionTypes.length > 0 && staffList.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-1.5 mb-0.5"><Settings className="w-4 h-4 text-primary" />管理設定</h2>
        </div>
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
          aria-label={isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>
      </div>

      {/* Timeline toggle */}
      <div className="bg-card border border-border rounded-xl p-3 mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <div>
            <p className="text-xs font-semibold">タイムライン機能</p>
            <p className="text-[10px] text-muted-foreground">スタッフの時間軸表示を有効にします</p>
          </div>
        </div>
        <button
          onClick={() => onToggleTimeline && onToggleTimeline(!showTimeline)}
          className={`relative w-10 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${showTimeline ? "bg-primary" : "bg-muted-foreground/30"}`}
          aria-label="タイムライン切り替え"
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showTimeline ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Debug tools */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-3 mb-3 shadow-sm dark:bg-amber-950/40 dark:border-amber-500">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-200 text-amber-900 dark:bg-amber-500/25 dark:text-amber-200 shrink-0">
              <Bug className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-950 dark:text-amber-100">デバッグ機能</p>
              <p className="text-[10px] text-amber-900 dark:text-amber-200 truncate">各時間帯にポジションとスタッフを自動配置します</p>
            </div>
          </div>
          <button
            onClick={() => isAdmin && toggleDebugMutation.mutate(!debugEnabled)}
            disabled={!isAdmin || toggleDebugMutation.isPending}
            className={`relative w-10 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 ${debugEnabled ? "bg-amber-600" : "bg-amber-300/70 dark:bg-amber-900"}`}
            aria-label="デバッグ機能切り替え"
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${debugEnabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
        <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-300 bg-red-50 px-2 py-1.5 text-red-800 dark:border-red-500/70 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p className="text-[10px] font-semibold leading-relaxed">この変更は登録されたデータに変更を加えます。元に戻すことはできません。</p>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[10px] text-amber-900 dark:text-amber-200">
            {staffList.length === 0 ? "スタッフ登録後に実行できます" : `登録スタッフ${staffList.length}名を順番に割り当てます`}
          </p>
          <Button
            onClick={() => setConfirmAutoPlace(true)}
            disabled={!canAutoPlace || autoPlaceMutation.isPending}
            size="sm"
            className="gap-1 h-7 text-xs px-2 shrink-0 bg-red-600 hover:bg-red-700 text-white"
          >
            {autoPlaceMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
            自動配置
          </Button>
        </div>
      </div>

      {/* Position type section */}
      <div className="mb-1">
        <h3 className="text-xs font-bold flex items-center gap-1.5 mb-1.5"><Settings className="w-3.5 h-3.5 text-primary" />ポジション設定</h3>
        <p className="text-[10px] text-muted-foreground mb-2">プリセット適用時に使用されるポジション一覧です。</p>
      </div>

      {/* Add form */}
      <div className="bg-card border border-border rounded-xl p-2.5 mb-2">
        <p className="text-[11px] font-medium mb-1.5 text-muted-foreground">ポジションを追加</p>
        <div className="space-y-1.5">
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="ポジション名（例：メイン受付A）" className="h-8 text-sm" />
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 flex-1">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <Button onClick={handleAdd} disabled={!isAdmin || !name.trim() || createMutation.isPending} size="sm" className="gap-1 h-7 shrink-0">
              <Plus className="w-3 h-3" />追加
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : positionTypes.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Settings className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">ポジションが登録されていません</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-2">
          {positionTypes.map((pt, idx) => (
            <div key={pt.id}
              className={`px-2.5 py-2 ${idx > 0 ? "border-t border-border/50" : ""} ${draggingId === pt.id ? "opacity-40" : ""} ${dragOverId === pt.id ? "ring-2 ring-inset ring-primary" : ""}`}
              onDragOver={(e) => handleDragOver(e, pt.id)}
              onDrop={(e) => handleDrop(e, pt.id)}
            >
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <div draggable onDragStart={(e) => handleDragStart(e, pt.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: pt.color || "#6366f1" }} />
                <span className="font-medium text-xs flex-1 min-w-0 truncate">{pt.name}</span>
                <label className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(pt.split_by_side)}
                    onChange={(e) => handleToggleSplitBySide(pt, e.target.checked)}
                    disabled={!isAdmin}
                    className="w-3 h-3 accent-primary disabled:opacity-40"
                  />
                  上手/下手
                </label>
                <button onClick={() => setConfirmDelete({ id: pt.id, name: pt.name })} disabled={!isAdmin}
                  className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog message={`「${confirmDelete.name}」を削除しますか？`} confirmLabel="削除"
          onConfirm={() => { deleteMutation.mutate(confirmDelete.id); setConfirmDelete(null); }}
          onCancel={() => setConfirmDelete(null)} />
      )}

      {confirmAutoPlace && (
        <ConfirmDialog
          message={"この変更は登録されたデータに変更を加えます。元に戻すことはできません。\n\n各時間帯のポジションとスタッフ配置を自動更新します。実行しますか？"}
          confirmLabel="自動配置を実行"
          onConfirm={() => { autoPlaceMutation.mutate(); setConfirmAutoPlace(false); }}
          onCancel={() => setConfirmAutoPlace(false)}
        />
      )}

      <div className="border-t border-border my-3" />
      <PositionPresetManager eventId={eventId} />
      <MapTemplateManagement eventId={eventId} />
    </div>
  );
}

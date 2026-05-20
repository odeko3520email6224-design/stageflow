import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { TIME_SLOTS } from "@/lib/constants";
import ConfirmDialog from "@/components/ConfirmDialog";
import { loadEventById } from "@/lib/eventLoader";

export default function PresetSelector({ eventId, compact = false }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const queryClient = useQueryClient();
  const { canEdit: isAdmin } = useUserRole();

  const { data: presets = [] } = useQuery({
    queryKey: ["positionPresets"],
    queryFn: () => base44.entities.PositionPreset.list(),
  });

  const { data: positionTypes = [] } = useQuery({
    queryKey: ["positionTypes"],
    queryFn: () => base44.entities.PositionType.list(),
  });

  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => loadEventById(eventId),
  });

  const activePreset = presets.find((p) => p.id === event?.active_preset_id);

  const applyMutation = useMutation({
    mutationFn: async (preset) => {
      const existing = await base44.entities.Position.filter({ event_id: eventId });
      if (existing.length > 0) await Promise.all(existing.map((p) => base44.entities.Position.delete(p.id)));
      const slotMap = preset.slot_positions || {};
      const slotToField = { "開場中": "required_count_before", "開演中": "required_count_during", "終演後": "required_count_after" };
      const creates = [];
      for (const slot of TIME_SLOTS) {
        const ids = slotMap[slot] || [];
        for (let i = 0; i < ids.length; i++) {
          const pt = positionTypes.find((p) => p.id === ids[i]);
          if (pt) {
            const field = slotToField[slot];
            creates.push(base44.entities.Position.create({
              event_id: eventId, name: pt.name, color: pt.color || "#6366f1",
              time_slot: slot, staff_names: [],
              required_count: field ? (pt[field] ?? pt.required_count ?? 0) : 0,
              order: i,
            }));
          }
        }
      }
      await Promise.all(creates);
      await base44.entities.Event.update(eventId, { active_preset_id: preset.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      setOpen(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => base44.entities.Event.update(eventId, { active_preset_id: null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event", eventId] }),
  });

  if (!isAdmin) return null;

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-border bg-card px-2 text-xs font-medium transition-colors hover:bg-muted/40"
        >
          <BookOpen className="w-3 h-3 text-primary" />
          {activePreset
            ? <span className="text-primary font-semibold max-w-[80px] truncate">{activePreset.name}</span>
            : <span className="text-muted-foreground">プリセット</span>}
          {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-8 z-50 w-56 border border-border rounded-xl bg-card shadow-lg overflow-hidden">
              {presets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">プリセットが登録されていません</p>
              ) : (
                <div className="divide-y divide-border">
                  {presets.map((preset) => {
                    const isActive = event?.active_preset_id === preset.id;
                    const totalSlots = Object.values(preset.slot_positions || {}).flat().length;
                    return (
                      <div key={preset.id} className={`flex items-center gap-2 px-3 py-2 ${isActive ? "bg-primary/5" : "hover:bg-muted/40"} transition-colors`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold truncate">{preset.name}</span>
                            {isActive && <span className="text-[9px] font-bold px-1 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">適用中</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground">計{totalSlots}ポジション</div>
                        </div>
                        {isActive ? (
                          <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 shrink-0"
                            disabled={clearMutation.isPending} onClick={() => setConfirm({ type: 'clear' })}>
                            解除
                          </Button>
                        ) : (
                          <Button size="sm" className="h-6 text-[11px] px-2 gap-1 shrink-0"
                            disabled={applyMutation.isPending} onClick={() => setConfirm({ type: 'apply', preset })}>
                            <Zap className="w-2.5 h-2.5" />適用
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {confirm?.type === 'apply' && (
          <ConfirmDialog message={`「${confirm.preset.name}」を適用しますか？\n現在のポジションは一度リセットされます。`}
            confirmLabel="適用" confirmVariant="default"
            onConfirm={() => { applyMutation.mutate(confirm.preset); setConfirm(null); }}
            onCancel={() => setConfirm(null)} />
        )}
        {confirm?.type === 'clear' && (
          <ConfirmDialog message="プリセットの適用を解除しますか？" confirmLabel="解除" confirmVariant="default"
            onConfirm={() => { clearMutation.mutate(); setConfirm(null); }}
            onCancel={() => setConfirm(null)} />
        )}
      </div>
    );
  }

  // Full mode (original)
  return (
    <div className="mb-1">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-xs font-medium">
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          {activePreset
            ? <span>適用中プリセット：<span className="text-primary font-semibold">{activePreset.name}</span></span>
            : <span className="text-muted-foreground">プリセットを選択して適用...</span>}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-1 border border-border rounded-xl bg-card shadow-sm overflow-hidden">
          {presets.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">プリセットが登録されていません</p>
          ) : (
            <div className="divide-y divide-border">
              {presets.map((preset) => {
                const isActive = event?.active_preset_id === preset.id;
                const totalSlots = Object.values(preset.slot_positions || {}).flat().length;
                return (
                  <div key={preset.id} className={`flex items-center gap-3 px-3 py-2 ${isActive ? "bg-primary/5" : "hover:bg-muted/40"} transition-colors`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold">{preset.name}</span>
                        {isActive && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">適用中</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {preset.description ? `${preset.description}・` : ""}計{totalSlots}ポジション
                      </div>
                    </div>
                    {isActive ? (
                      <Button size="sm" variant="outline" className="h-6 text-[11px] px-2 shrink-0"
                        disabled={clearMutation.isPending} onClick={() => setConfirm({ type: 'clear' })}>
                        {clearMutation.isPending ? "..." : "解除"}
                      </Button>
                    ) : (
                      <Button size="sm" className="h-6 text-[11px] px-2 gap-1 shrink-0"
                        disabled={applyMutation.isPending} onClick={() => setConfirm({ type: 'apply', preset })}>
                        <Zap className="w-2.5 h-2.5" />{applyMutation.isPending ? "適用中..." : "適用"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {confirm?.type === 'apply' && (
        <ConfirmDialog message={`「${confirm.preset.name}」を適用しますか？\n現在のポジションは一度リセットされます。`}
          confirmLabel="適用" confirmVariant="default"
          onConfirm={() => { applyMutation.mutate(confirm.preset); setConfirm(null); }}
          onCancel={() => setConfirm(null)} />
      )}
      {confirm?.type === 'clear' && (
        <ConfirmDialog message="プリセットの適用を解除しますか？" confirmLabel="解除" confirmVariant="default"
          onConfirm={() => { clearMutation.mutate(); setConfirm(null); }}
          onCancel={() => setConfirm(null)} />
      )}
    </div>
  );
}

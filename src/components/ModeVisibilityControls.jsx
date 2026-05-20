import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, Lock } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { unwrapFunctionResponse } from "@/lib/base44Response";

const modeEventName = "stageflow:event-mode-change";
const normalizeMode = (mode) => (mode === "public" || mode === "edit" ? mode : "edit");

export function useResolvedEventMode(eventId, field, eventMode, options = {}) {
  const [localMode, setLocalMode] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const preferEvent = options.preferEvent === true;

  useEffect(() => {
    setLocalMode(null);
    setIsLoaded(true);
  }, [eventId, field]);

  useEffect(() => {
    const handleModeChange = (event) => {
      if (event.detail?.eventId === eventId && event.detail?.field === field) {
        setLocalMode(normalizeMode(event.detail.mode));
      }
    };
    window.addEventListener(modeEventName, handleModeChange);
    return () => window.removeEventListener(modeEventName, handleModeChange);
  }, [eventId, field]);

  useEffect(() => {
    if (localMode && normalizeMode(eventMode) === localMode) {
      setLocalMode(null);
    }
  }, [eventMode, localMode]);

  const resolvedMode = localMode && !preferEvent ? normalizeMode(localMode) : normalizeMode(eventMode);

  return {
    mode: resolvedMode,
    isReady: isLoaded || eventMode === "edit" || eventMode === "public",
  };
}

function rememberMode(eventId, field, mode) {
  window.dispatchEvent(new CustomEvent(modeEventName, {
    detail: { eventId, field, mode },
  }));
}

export function ModeVisibilityControls({ eventId, field, mode = "edit", canManage, label }) {
  const queryClient = useQueryClient();

  const updateMode = useMutation({
    mutationFn: async (nextMode) => {
      try {
        const response = await base44.functions.invoke("updateEventMode", {
          eventId,
          field,
          mode: nextMode,
        });
        const payload = unwrapFunctionResponse(response);
        if (payload?.error) throw new Error(payload.error);
        return payload?.event;
      } catch {
        const event = await base44.entities.Event.update(eventId, { [field]: nextMode });
        return { ...(event || {}), id: eventId, [field]: nextMode };
      }
    },
    onMutate: async (nextMode) => {
      rememberMode(eventId, field, nextMode);
      await queryClient.cancelQueries({ queryKey: ["event", eventId] });
      const previousEvent = queryClient.getQueryData(["event", eventId]);
      queryClient.setQueryData(["event", eventId], (old) => {
        if (Array.isArray(old)) {
          return old.map((item) => item.id === eventId ? { ...item, [field]: nextMode } : item);
        }
        return old ? { ...old, [field]: nextMode } : old;
      });
      queryClient.setQueriesData({ queryKey: ["events"] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((item) => item.id === eventId ? { ...item, [field]: nextMode } : item);
      });
      return { previousEvent };
    },
    onError: (_, __, context) => {
      const previousMode = normalizeMode(context?.previousEvent?.[field] || context?.previousEvent?.[0]?.[field]);
      rememberMode(eventId, field, previousMode);
      queryClient.setQueryData(["event", eventId], context?.previousEvent);
      toast.error("モードの保存に失敗しました");
    },
    onSuccess: (updatedEvent, nextMode) => {
      const savedMode = updatedEvent?.[field] || nextMode;
      rememberMode(eventId, field, savedMode);
      queryClient.setQueryData(["event", eventId], (old) => {
        if (Array.isArray(old)) {
          return old.map((item) => item.id === eventId ? { ...item, [field]: savedMode } : item);
        }
        return old ? { ...old, [field]: savedMode } : old;
      });
      queryClient.setQueriesData({ queryKey: ["events"] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((item) => item.id === eventId ? { ...item, [field]: savedMode } : item);
      });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("モードを保存しました");
    },
  });

  if (!canManage) return null;

  const options = [
    { value: "public", label: "閲覧・公開", icon: Eye },
    { value: "edit", label: "編集", icon: Pencil },
  ];

  return (
    <div className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-card p-1">
      <span className="hidden sm:inline-flex items-center gap-1 px-1.5 text-[10px] font-medium text-muted-foreground">
        <Lock className="w-3 h-3" />
        {label}
      </span>
      {options.map(({ value, label: optionLabel, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => updateMode.mutate(value)}
          disabled={updateMode.isPending || mode === value}
          className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11px] font-semibold transition-colors ${
            mode === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          } disabled:pointer-events-none`}
          aria-pressed={mode === value}
        >
          <Icon className="w-3 h-3" />
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

export function HiddenInEditMode({ title = "編集モード中です" }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-8 text-center text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
      <Lock className="w-8 h-8 mx-auto mb-2" />
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs">現在このページは編集モードのため、userロールでは内容を表示できません。</p>
    </div>
  );
}

export function ModeLoadingPlaceholder() {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-8 text-center text-muted-foreground">
      <div className="mx-auto mb-2 h-6 w-6 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      <p className="text-xs font-medium">表示モードを確認しています</p>
    </div>
  );
}

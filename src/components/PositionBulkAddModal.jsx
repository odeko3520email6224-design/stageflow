import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";
import { motion } from "framer-motion";
import { LIVE_SYNC_INTERVAL } from "@/lib/liveSync";
import { TIME_SLOTS } from "@/lib/constants";

export default function PositionBulkAddModal({ eventId, defaultTimeSlot = "開場中", onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [timeSlot, setTimeSlot] = useState(defaultTimeSlot);
  const [selectedIds, setSelectedIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data: positionTypes = [] } = useQuery({
    queryKey: ["positionTypes"],
    queryFn: () => base44.entities.PositionType.list(),
    select: (d) => [...d].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    refetchInterval: LIVE_SYNC_INTERVAL,
  });

  const { data: existingPositions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: async () => {
      const res = await base44.functions.invoke("getPositionList", { eventId });
      return res?.data?.positions ?? [];
    },
  });

  // Already-added names for the selected time slot
  const existingNames = new Set(
    existingPositions
      .filter((p) => (p.time_slot || "開場中") === timeSlot)
      .map((p) => p.name)
  );

  const availableTypes = positionTypes.filter((pt) => !existingNames.has(pt.name));

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === availableTypes.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableTypes.map((pt) => pt.id));
    }
  };

  const getRequiredCount = (pt) => {
    if (timeSlot === "開場中") return pt.required_count_before ?? pt.required_count ?? 0;
    if (timeSlot === "開演中") return pt.required_count_during ?? pt.required_count ?? 0;
    return pt.required_count_after ?? pt.required_count ?? 0;
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) return;
    setSaving(true);
    const startOrder = existingPositions.filter((p) => (p.time_slot || "開場中") === timeSlot).length;
    const targets = selectedIds
      .map((id) => positionTypes.find((pt) => pt.id === id))
      .filter(Boolean);

    await Promise.all(
      targets.map((pt, idx) =>
        base44.entities.Position.create({
          event_id: eventId,
          name: pt.name,
          time_slot: timeSlot,
          staff_names: [],
          notes: "",
          color: pt.color || "#6366f1",
          required_count: getRequiredCount(pt),
          order: startOrder + idx,
        })
      )
    );

    queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    toast.success(`${targets.length}件のポジションを追加しました`);
    onSaved();
    onClose();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-4 max-h-[88vh] flex flex-col"
        initial={{ y: 34, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <h2 className="text-base font-bold">ポジション追加</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Time slot tabs */}
        <div className="flex gap-1 mb-3 shrink-0">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              onClick={() => { setTimeSlot(slot); setSelectedIds([]); }}
              className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                timeSlot === slot
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {slot}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto scrollbar-hide min-h-0">
          {positionTypes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              管理タブでポジション種別を登録してください
            </p>
          ) : availableTypes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              この時間帯の全ポジションは追加済みです
            </p>
          ) : (
            <>
              {/* Select all */}
              <button
                onClick={toggleAll}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 rounded-lg mb-1 transition-colors"
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                  selectedIds.length === availableTypes.length && availableTypes.length > 0
                    ? "bg-primary border-primary"
                    : "border-border"
                }`}>
                  {selectedIds.length === availableTypes.length && availableTypes.length > 0 && (
                    <Check className="w-2.5 h-2.5 text-primary-foreground" />
                  )}
                </div>
                すべて選択
              </button>
              <div className="border border-border rounded-lg overflow-hidden">
                {availableTypes.map((pt, idx) => {
                  const selected = selectedIds.includes(pt.id);
                  return (
                    <button
                      key={pt.id}
                      onClick={() => toggle(pt.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors ${
                        idx < availableTypes.length - 1 ? "border-b border-border/60" : ""
                      } ${selected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/40"}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        selected ? "bg-primary border-primary" : "border-border"
                      }`}>
                        {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: pt.color || "#6366f1" }}
                      />
                      <span className="truncate">{pt.name}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 mt-4 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>キャンセル</Button>
          <Button
            className="flex-1"
            disabled={selectedIds.length === 0 || saving}
            onClick={handleSave}
          >
            {saving ? "追加中..." : `追加 (${selectedIds.length}件)`}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
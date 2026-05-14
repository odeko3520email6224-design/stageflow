import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Pencil, X, Move, Info, Map, MapPin, Clock } from "lucide-react";
import MapAreaFormModal from "@/components/MapAreaFormModal";

const ROLE_COLORS = {
  "受付": "#3b82f6",
  "誘導": "#10b981",
  "警備": "#ef4444",
  "その他": "#94a3b8",
};

const TIME_SLOTS = ["開場前", "開演中", "終演後"];
const TIME_SLOT_STYLES = {
  "開場前": "bg-amber-50 text-amber-800 border-amber-300",
  "開演中": "bg-blue-50 text-blue-800 border-blue-300",
  "終演後": "bg-slate-50 text-slate-700 border-slate-300",
};

function SidePanel({ positions, draggingPin, setDraggingPin, setMode, slotFilter }) {
  const filtered = positions.filter((p) => (p.time_slot || "開場前") === slotFilter);
  const onMap = filtered.filter((p) => p.map_x != null && p.map_y != null);
  const notOnMap = filtered.filter((p) => p.map_x == null || p.map_y == null);

  return (
    <div className="w-full lg:w-48 flex-shrink-0 space-y-3">
      {/* Unplaced positions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><MapPin className="w-3 h-3" />未配置ポジション</p>
        {notOnMap.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted rounded-lg p-2 text-center">全て配置済みです</div>
        ) : (
          <div className="space-y-1">
            {notOnMap.map((pos) => (
              <button
                key={pos.id}
                onClick={() => { setDraggingPin(pos); setMode("move-pin"); }}
                className={`w-full flex items-center gap-2 bg-card border rounded-lg px-2 py-1.5 text-left transition-all hover:border-primary/50 ${draggingPin?.id === pos.id ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="w-4 h-4 rounded-full border-2 border-white shadow flex-shrink-0" style={{ backgroundColor: pos.color || ROLE_COLORS[pos.role] || "#6366f1" }} />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{pos.name}</div>
                  {(pos.staff_names || []).length > 0 && (
                    <div className="text-[10px] text-muted-foreground truncate">{pos.staff_names.join("・")}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Placed positions */}
      {onMap.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Map className="w-3 h-3" />配置済み</p>
          <div className="space-y-1">
            {onMap.map((pos) => (
              <div key={pos.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40 border border-border">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pos.color || ROLE_COLORS[pos.role] || "#6366f1" }} />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{pos.name}</div>
                  {(pos.staff_names || []).length > 0 && (
                    <div className="text-[10px] text-muted-foreground truncate">{pos.staff_names.join("・")}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VenueMap({ eventId }) {
  const queryClient = useQueryClient();
  const mapRef = useRef(null);
  const [mode, setMode] = useState("view");
  const [draggingPin, setDraggingPin] = useState(null);
  const [editingArea, setEditingArea] = useState(null);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [slotFilter, setSlotFilter] = useState("開場前");
  const longPressTimer = useRef(null);

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }),
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["mapareas", eventId],
    queryFn: () => base44.entities.MapArea.filter({ event_id: eventId }, "order"),
  });

  const updatePosition = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Position.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["positions", eventId] }),
  });

  const deleteArea = useMutation({
    mutationFn: (id) => base44.entities.MapArea.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mapareas", eventId] }),
  });

  const getMapCoords = useCallback((e) => {
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }, []);

  const handleMapClick = (e) => {
    if (mode !== "move-pin" || !draggingPin) return;
    const { x, y } = getMapCoords(e);
    updatePosition.mutate({ id: draggingPin.id, data: { map_x: x, map_y: y } });
    setDraggingPin(null);
    setMode("view");
  };

  const handlePinClick = (e, pos) => {
    e.stopPropagation();
    if (mode === "view") {
      setTooltip(tooltip?.id === pos.id ? null : pos);
    } else if (mode === "move-pin") {
      setDraggingPin(pos);
    }
  };

  // Long-press to enter move mode on mobile
  const handlePinTouchStart = (e, pos) => {
    longPressTimer.current = setTimeout(() => {
      e.preventDefault();
      setTooltip(null);
      setDraggingPin(pos);
      setMode("move-pin");
    }, 500);
  };

  const handlePinTouchEnd = () => {
    clearTimeout(longPressTimer.current);
  };

  // Touch tap on map to place pin
  const handleMapTouchEnd = (e) => {
    if (mode !== "move-pin" || !draggingPin) return;
    const touch = e.changedTouches[0];
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    updatePosition.mutate({
      id: draggingPin.id,
      data: { map_x: Math.max(0, Math.min(100, x)), map_y: Math.max(0, Math.min(100, y)) },
    });
    setDraggingPin(null);
    setMode("view");
  };

  // Filter pins by slot tab
  const filteredPositions = slotFilter === "all"
    ? positions
    : positions.filter((p) => (p.time_slot || "開場前") === slotFilter);

  const positionsOnMap = filteredPositions.filter((p) => p.map_x != null && p.map_y != null);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><Map className="w-5 h-5 text-primary" />会場マップ</h2>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant={mode === "move-pin" ? "default" : "outline"}
            onClick={() => setMode(mode === "move-pin" ? "view" : "move-pin")}
            className="gap-1 h-7 text-xs"
          >
            <Move className="w-3 h-3" />
            {mode === "move-pin" ? "配置中..." : "ピン移動"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setEditingArea(null); setShowAreaModal(true); }}
            className="gap-1 h-7 text-xs"
          >
            <Plus className="w-3 h-3" />エリア追加
          </Button>
        </div>
      </div>

      {/* Slot filter tabs */}
      <div className="flex gap-0 border-b border-border mb-3">
        {TIME_SLOTS.map((slot) => (
          <button
            key={slot}
            onClick={() => { setSlotFilter(slot); setTooltip(null); }}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-all ${
              slotFilter === slot ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {slot}
          </button>
        ))}
      </div>

      {mode === "move-pin" && (
        <div className="mb-2 text-xs text-primary bg-primary/10 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          {draggingPin ? `「${draggingPin.name}」をマップ上でタップ/クリックして配置` : "ピンを長押し（スマホ）またはリストから選択してマップ上に配置"}
          <button onClick={() => { setMode("view"); setDraggingPin(null); }} className="ml-auto">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Mobile: horizontal scroll wrapper / Desktop: flex row */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Map Canvas */}
        <div className="flex-1 -mx-4 lg:mx-0 overflow-x-auto lg:overflow-visible">
          <div className="px-4 lg:px-0" style={{ minWidth: 560 }}>
          <div
            ref={mapRef}
            onClick={handleMapClick}
            onTouchEnd={handleMapTouchEnd}
            className={`relative bg-slate-100 border-2 ${mode === "move-pin" ? "border-primary cursor-crosshair" : "border-border cursor-default"} rounded-xl overflow-hidden`}
            style={{ aspectRatio: "16/9", minHeight: 280 }}
          >
            {/* Areas */}
            {areas.map((area) => (
              <div key={area.id} className="absolute group" style={{
                left: `${area.x ?? 5}%`,
                top: `${area.y ?? 5}%`,
                width: `${area.width ?? 20}%`,
                height: `${area.height ?? 15}%`,
                backgroundColor: area.color || "#e2e8f0",
                borderRadius: area.type === "circle" ? "50%" : "8px",
                border: "2px solid rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
              }}>
                <span className="text-xs font-semibold text-slate-600 select-none px-1 text-center leading-tight">{area.name}</span>
                <div className="absolute top-1 right-1 hidden group-hover:flex gap-1 z-10">
                  <button onClick={(e) => { e.stopPropagation(); setEditingArea(area); setShowAreaModal(true); }} className="bg-white rounded p-0.5 shadow text-slate-500 hover:text-primary">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm("削除しますか？")) deleteArea.mutate(area.id); }} className="bg-white rounded p-0.5 shadow text-slate-500 hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}

            {/* Position Pins */}
            {positionsOnMap.map((pos) => {
              const isActive = tooltip?.id === pos.id;
              return (
                <div
                  key={pos.id}
                  className="absolute z-20"
                  style={{ left: `${pos.map_x}%`, top: `${pos.map_y}%`, transform: "translate(-50%, -50%)" }}
                >
                  <button
                    onClick={(e) => handlePinClick(e, pos)}
                    onTouchStart={(e) => handlePinTouchStart(e, pos)}
                    onTouchEnd={handlePinTouchEnd}
                    onTouchMove={handlePinTouchEnd}
                    className="flex flex-col items-center group"
                  >
                    <div
                      className="w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold transition-transform group-hover:scale-110"
                      style={{ backgroundColor: pos.color || ROLE_COLORS[pos.role] || "#6366f1" }}
                    >
                      {(pos.name || pos.role)?.[0] || "?"}
                    </div>
                    <div className="bg-white/90 backdrop-blur text-foreground text-[10px] font-medium px-1.5 py-0.5 rounded shadow mt-0.5 max-w-[80px] text-center leading-tight">
                      <div className="font-semibold truncate">{pos.name || pos.role}</div>
                      {(pos.staff_names || []).length > 0 && (
                        <div className="text-muted-foreground truncate">{pos.staff_names.join("・")}</div>
                      )}
                    </div>
                  </button>

                  {/* Tooltip - positioned to avoid overflow */}
                  {isActive && (
                    <div
                      className="absolute z-40 bg-card border border-border rounded-xl shadow-xl p-2.5 w-40"
                      style={{
                        left: pos.map_x > 60 ? "auto" : "50%",
                        right: pos.map_x > 60 ? "110%" : "auto",
                        transform: pos.map_x > 60 ? "none" : "translateX(-50%)",
                        top: pos.map_y > 70 ? "auto" : "100%",
                        bottom: pos.map_y > 70 ? "110%" : "auto",
                        marginTop: pos.map_y <= 70 ? "4px" : "0",
                      }}
                    >
                      <button onClick={() => setTooltip(null)} className="absolute top-1.5 right-1.5 text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                      <div className="font-semibold text-xs mb-1 pr-4">{pos.name || pos.role}</div>
                      <div className="text-xs text-muted-foreground">
                        {(pos.staff_names || []).length > 0
                          ? <span>担当: {pos.staff_names.join("、")}</span>
                          : <span>担当者未設定</span>
                        }
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("このピンをマップから外しますか？")) {
                            updatePosition.mutate({ id: pos.id, data: { map_x: null, map_y: null } });
                            setTooltip(null);
                          }
                        }}
                        className="mt-2 text-xs text-destructive hover:underline"
                      >
                        マップから外す
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {areas.length === 0 && positionsOnMap.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs text-center px-4">
                「エリア追加」でマップを作成し、右のリストからピンを配置してください
              </div>
            )}
          </div>
          </div>{/* minWidth wrapper */}
        </div>

        {/* Side panel */}
        <SidePanel
          positions={positions}
          draggingPin={draggingPin}
          setDraggingPin={setDraggingPin}
          setMode={setMode}
          slotFilter={slotFilter}
        />
      </div>

      {showAreaModal && (
        <MapAreaFormModal
          area={editingArea}
          eventId={eventId}
          onClose={() => setShowAreaModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["mapareas", eventId] });
            setShowAreaModal(false);
          }}
        />
      )}
    </div>
  );
}
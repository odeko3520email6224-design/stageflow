import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Square, Circle, Trash2, Pencil, X, Move, Info } from "lucide-react";
import MapAreaFormModal from "@/components/MapAreaFormModal";

const ROLE_COLORS = {
  "受付": "#3b82f6",
  "誘導": "#10b981",
  "警備": "#ef4444",
  "その他": "#94a3b8",
};

export default function VenueMap({ eventId }) {
  const queryClient = useQueryClient();
  const mapRef = useRef(null);
  const [mode, setMode] = useState("view"); // view | move-pin | add-area
  const [draggingPin, setDraggingPin] = useState(null);
  const [editingArea, setEditingArea] = useState(null);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [tooltip, setTooltip] = useState(null);

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

  const positionsOnMap = positions.filter((p) => p.map_x != null && p.map_y != null);
  const positionsNotOnMap = positions.filter((p) => p.map_x == null || p.map_y == null);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Map Area */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">会場マップ</h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "move-pin" ? "default" : "outline"}
              onClick={() => setMode(mode === "move-pin" ? "view" : "move-pin")}
              className="gap-1.5"
            >
              <Move className="w-3.5 h-3.5" />
              {mode === "move-pin" ? "配置中..." : "ピン移動"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setEditingArea(null); setShowAreaModal(true); }}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              エリア追加
            </Button>
          </div>
        </div>

        {mode === "move-pin" && (
          <div className="mb-3 text-sm text-primary bg-primary/10 rounded-lg px-4 py-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            {draggingPin
              ? `「${draggingPin.name}」をマップ上でクリックして配置`
              : "右の一覧からピンを選択するか、マップ上のピンをクリックして移動先を指定"}
            <button onClick={() => { setMode("view"); setDraggingPin(null); }} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Map Canvas */}
        <div
          ref={mapRef}
          onClick={handleMapClick}
          className={`relative bg-slate-100 border-2 ${mode === "move-pin" ? "border-primary cursor-crosshair" : "border-border cursor-default"} rounded-2xl overflow-hidden`}
          style={{ aspectRatio: "16/9", minHeight: 320 }}
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
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingArea(area); setShowAreaModal(true); }}
                  className="bg-white rounded p-0.5 shadow text-slate-500 hover:text-primary"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm("削除しますか？")) deleteArea.mutate(area.id); }}
                  className="bg-white rounded p-0.5 shadow text-slate-500 hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {/* Position Pins */}
          {positionsOnMap.map((pos) => (
            <div
              key={pos.id}
              className="absolute z-20"
              style={{ left: `${pos.map_x}%`, top: `${pos.map_y}%`, transform: "translate(-50%, -50%)" }}
            >
              <button
                onClick={(e) => handlePinClick(e, pos)}
                className="flex flex-col items-center group"
              >
                <div
                  className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold transition-transform group-hover:scale-110"
                  style={{ backgroundColor: pos.color || ROLE_COLORS[pos.role] || "#6366f1" }}
                >
                  {pos.name?.[0] || "?"}
                </div>
                <div className="bg-white/90 backdrop-blur text-foreground text-[10px] font-medium px-1.5 py-0.5 rounded shadow mt-0.5 whitespace-nowrap max-w-[80px] truncate">
                  {pos.name}
                </div>
              </button>
              {/* Tooltip */}
              {tooltip?.id === pos.id && (
                <div className="absolute z-30 bg-card border border-border rounded-xl shadow-xl p-3 w-44 -translate-x-1/2 mt-1 left-1/2">
                  <div className="font-semibold text-sm mb-1">{pos.name}</div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>役割: {pos.role}</div>
                    {pos.staff_name && <div>担当: {pos.staff_name}</div>}
                    {pos.staff_count > 1 && <div>人数: {pos.staff_count}名</div>}
                    {pos.notes && <div className="truncate">備考: {pos.notes}</div>}
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
          ))}

          {areas.length === 0 && positionsOnMap.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              「エリア追加」でマップを作成し、右のリストからピンを配置してください
            </div>
          )}
        </div>
      </div>

      {/* Side panel: unplaced positions */}
      <div className="w-full lg:w-64 flex-shrink-0">
        <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">未配置スタッフ</h3>
        {positionsNotOnMap.length === 0 ? (
          <div className="text-xs text-muted-foreground bg-muted rounded-xl p-4 text-center">全員配置済みです</div>
        ) : (
          <div className="space-y-2">
            {positionsNotOnMap.map((pos) => (
              <button
                key={pos.id}
                onClick={() => {
                  setDraggingPin(pos);
                  setMode("move-pin");
                }}
                className={`w-full flex items-center gap-2 bg-card border rounded-xl px-3 py-2.5 text-left transition-all hover:border-primary/50 hover:shadow-sm ${draggingPin?.id === pos.id ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div
                  className="w-6 h-6 rounded-full border-2 border-white shadow flex-shrink-0"
                  style={{ backgroundColor: pos.color || ROLE_COLORS[pos.role] || "#6366f1" }}
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{pos.name}</div>
                  <div className="text-[10px] text-muted-foreground">{pos.role}{pos.staff_name ? ` · ${pos.staff_name}` : ""}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {positionsOnMap.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">配置済み</h3>
            <div className="space-y-1.5">
              {positionsOnMap.map((pos) => (
                <div key={pos.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pos.color || ROLE_COLORS[pos.role] || "#6366f1" }} />
                  <span className="text-xs truncate">{pos.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
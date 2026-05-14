import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Trash2, AlertCircle, ClipboardList } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const ROLE_COLORS = {
  "受付": "bg-blue-100 text-blue-700 border-blue-200",
  "誘導": "bg-green-100 text-green-700 border-green-200",
  "警備": "bg-red-100 text-red-700 border-red-200",
  "その他": "bg-slate-100 text-slate-600 border-slate-200",
};

const TIME_SLOTS = ["開場前", "開演中", "終演後"];

const TIME_SLOT_STYLES = {
  "開場前": { header: "bg-amber-50 border-amber-200 text-amber-800", badge: "bg-amber-100 text-amber-700 border-amber-300" },
  "開演中": { header: "bg-blue-50 border-blue-200 text-blue-800", badge: "bg-blue-100 text-blue-700 border-blue-300" },
  "終演後": { header: "bg-slate-50 border-slate-200 text-slate-700", badge: "bg-slate-100 text-slate-600 border-slate-300" },
};

export default function StaffDragDropManager({ eventId }) {
  const queryClient = useQueryClient();
  const { canEdit: isAdmin } = useUserRole();

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", eventId],
    queryFn: () => base44.entities.Position.filter({ event_id: eventId }),
  });

  const updatePositionMutation = useMutation({
    mutationFn: ({ positionId, staffNames }) =>
      base44.entities.Position.update(positionId, { staff_names: staffNames }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions", eventId] });
    },
  });

  const handleDragEnd = (result) => {
    if (!isAdmin) return;

    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const staffName = draggableId;
    const destinationPositionId = destination.droppableId;

    const position = positions.find((p) => p.id === destinationPositionId);
    if (!position) return;

    const currentStaffNames = position.staff_names || [];
    if (currentStaffNames.includes(staffName)) return;

    const updatedStaffNames = [...currentStaffNames, staffName];
    updatePositionMutation.mutate({
      positionId: destinationPositionId,
      staffNames: updatedStaffNames,
    });
  };

  const removeStaffFromPosition = (positionId, staffName) => {
    if (!isAdmin) return;

    const position = positions.find((p) => p.id === positionId);
    if (!position) return;

    const updatedStaffNames = (position.staff_names || []).filter(
      (name) => name !== staffName
    );
    updatePositionMutation.mutate({
      positionId: positionId,
      staffNames: updatedStaffNames,
    });
  };

  const grouped = TIME_SLOTS.reduce((acc, slot) => {
    acc[slot] = positions.filter((p) => (p.time_slot || "開場前") === slot);
    return acc;
  }, {});

  const assignedNames = new Set(positions.flatMap((p) => p.staff_names || []));
  const unassigned = staffList.filter((s) => !assignedNames.has(s.name));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary" />ドラッグで配置</h2>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-3">
          {TIME_SLOTS.map((slot) => {
            const style = TIME_SLOT_STYLES[slot];
            return (
              <div key={slot} className={`border rounded-xl overflow-hidden ${style.header.split(" ").slice(0, 2).join(" ")}`}>
                {/* Section header */}
                <div className={`flex items-center justify-between px-4 py-2 border-b ${style.header}`}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{slot}</span>
                    <span className="text-xs opacity-70">{grouped[slot].length}件</span>
                  </div>
                </div>

                {/* Positions and drag zones */}
                <div className="bg-card p-3">
                  {grouped[slot].length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">このタイムスロットにポジションがありません</p>
                  ) : (
                    <div className="grid gap-1.5">
                      {grouped[slot].map((pos) => (
                        <Droppable key={pos.id} droppableId={pos.id} type="STAFF">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors ${
                                snapshot.isDraggingOver ? "bg-blue-50 border-blue-300" : ""
                              }`}
                            >
                              {/* Position header row */}
                              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/20">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color || "#6366f1" }} />
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[pos.role]}`}>{pos.role}</span>
                                {pos.notes && <span className="text-xs text-muted-foreground truncate flex-1">{pos.notes}</span>}
                              </div>

                              {/* Staff items */}
                              <div className="divide-y divide-border/40 min-h-[40px]">
                                {(pos.staff_names || []).length > 0 ? (
                                  pos.staff_names.map((name, i) => (
                                    <Draggable
                                      key={`${pos.id}-${name}`}
                                      draggableId={`${name}-${pos.id}`}
                                      index={i}
                                      isDragDisabled={!isAdmin}
                                    >
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`flex items-center justify-between gap-2 px-3 py-1.5 cursor-move ${
                                            snapshot.isDragging ? "opacity-50 shadow-lg" : ""
                                          }`}
                                        >
                                          <span className="text-xs font-medium text-foreground flex-1">{pos.name || pos.role}</span>
                                          <span className="text-xs text-foreground">{name}</span>
                                          {isAdmin && (
                                            <button
                                              onClick={() => removeStaffFromPosition(pos.id, name)}
                                              className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </Draggable>
                                  ))
                                ) : (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">スタッフをドラッグして配置</div>
                                )}
                              </div>

                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Unassigned staff */}
      {(() => {
        if (unassigned.length === 0) return null;
        return (
          <div className="mt-3 border border-amber-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="font-bold text-sm">未配置スタッフ</span>
              <span className="text-xs opacity-70">{unassigned.length}名</span>
            </div>
            <div className="bg-card p-3 grid gap-1.5">
              <Droppable droppableId="unassigned" type="STAFF">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`grid gap-1.5 min-h-[40px] ${
                      snapshot.isDraggingOver ? "bg-amber-50" : ""
                    }`}
                  >
                    {unassigned.map((s, idx) => (
                      <Draggable
                        key={s.id}
                        draggableId={s.name}
                        index={idx}
                        isDragDisabled={!isAdmin}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-amber-50/50 border border-amber-100 cursor-move ${
                              snapshot.isDragging ? "opacity-50 shadow-lg" : ""
                            }`}
                          >
                            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            <span className="text-sm font-medium">{s.name}</span>
                            {s.note && <span className="text-xs text-muted-foreground">{s.note}</span>}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
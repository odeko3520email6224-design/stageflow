import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Trash2, Users } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const ROLE_COLORS = {
  "受付": "bg-blue-100 text-blue-700 border-blue-200",
  "誘導": "bg-green-100 text-green-700 border-green-200",
  "警備": "bg-red-100 text-red-700 border-red-200",
  "その他": "bg-slate-100 text-slate-600 border-slate-200",
};

const TIME_SLOTS = ["開場前", "開演中", "終演後"];

const TIME_SLOT_COLORS = {
  "開場前": "bg-amber-50 border-amber-200",
  "開演中": "bg-blue-50 border-blue-200",
  "終演後": "bg-slate-50 border-slate-200",
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

  const assignedStaff = new Set(
    positions.flatMap((p) => p.staff_names || [])
  );
  const unassignedStaff = staffList.filter((s) => !assignedStaff.has(s.name));

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Unassigned Staff Column */}
        <div className="bg-card border border-amber-200 rounded-xl overflow-hidden">
          <div className="bg-amber-100 text-amber-800 px-4 py-2 font-bold flex items-center gap-2">
            <Users className="w-4 h-4" />
            未配置スタッフ ({unassignedStaff.length})
          </div>
          <Droppable droppableId="unassigned" isDropDisabled={false}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`p-3 min-h-[200px] ${
                  snapshot.isDraggingOver ? "bg-amber-50" : "bg-white"
                }`}
              >
                {unassignedStaff.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    すべてのスタッフが配置されました
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {unassignedStaff.map((staff, index) => (
                      <Draggable
                        key={staff.id}
                        draggableId={staff.name}
                        index={index}
                        isDragDisabled={!isAdmin}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`p-2 rounded-lg border bg-white cursor-move transition-all ${
                              snapshot.isDragging
                                ? "shadow-lg opacity-50"
                                : "hover:border-primary/50"
                            }`}
                          >
                            <div className="text-xs font-medium text-foreground">
                              {staff.name}
                            </div>
                            {staff.note && (
                              <div className="text-[10px] text-muted-foreground">
                                {staff.note}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>

        {/* Time Slot Sections */}
        <div className="space-y-3">
          {TIME_SLOTS.map((slot) => {
            const slotPositions = positions.filter(
              (p) => (p.time_slot || "開場前") === slot
            );

            return (
              <div
                key={slot}
                className={`border rounded-xl overflow-hidden ${
                  TIME_SLOT_COLORS[slot]
                }`}
              >
                <div className="px-4 py-2 bg-opacity-70 font-bold text-sm">
                  {slot} ({slotPositions.length}件)
                </div>

                <div className="p-3 space-y-2 bg-white">
                  {slotPositions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      このタイムスロットにポジションがありません
                    </p>
                  ) : (
                    slotPositions.map((position) => (
                      <Droppable
                        key={position.id}
                        droppableId={position.id}
                        type="STAFF"
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`border rounded-lg p-2 min-h-[60px] transition-all ${
                              snapshot.isDraggingOver
                                ? "bg-blue-50 border-blue-300"
                                : "bg-slate-50 border-border"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor:
                                    position.color || "#6366f1",
                                }}
                              />
                              <span
                                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                                  ROLE_COLORS[position.role]
                                }`}
                              >
                                {position.role}
                              </span>
                              <span className="text-xs font-medium text-foreground flex-1">
                                {position.name}
                              </span>
                            </div>

                            {(position.staff_names || []).length > 0 && (
                              <div className="space-y-1">
                                {position.staff_names.map((staffName, idx) => (
                                  <Draggable
                                    key={`${position.id}-${staffName}`}
                                    draggableId={`${staffName}-${position.id}`}
                                    index={idx}
                                    isDragDisabled={!isAdmin}
                                  >
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`flex items-center justify-between gap-1 px-2 py-1 rounded bg-yellow-100 border border-yellow-300 text-xs transition-all ${
                                          snapshot.isDragging
                                            ? "shadow-lg opacity-50"
                                            : ""
                                        }`}
                                      >
                                        <span className="font-medium text-foreground flex-1">
                                          {staffName}
                                        </span>
                                        {isAdmin && (
                                          <button
                                            onClick={() =>
                                              removeStaffFromPosition(
                                                position.id,
                                                staffName
                                              )
                                            }
                                            className="p-0.5 hover:bg-red-200 rounded transition-colors"
                                          >
                                            <Trash2 className="w-3 h-3 text-red-600" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                              </div>
                            )}

                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DragDropContext>
  );
}
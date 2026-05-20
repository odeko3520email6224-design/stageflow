import { Pencil, Trash2, Minus, Plus } from "lucide-react";

export default function PositionCard({
  pos, isAdmin, draggable = false, draggedStaff = null,
  onEdit, onDelete, onDragOver, onDrop, onStaffDragStart, onStaffRemove,
  emptyLabel = "スタッフ未登録", staffList = [],
  requiredCount = 0, onRequiredCountChange, occupiedInSlot = [],
}) {
  const staffNames = pos.staff_names || [];
  const assignedCount = staffNames.length;
  const diff = requiredCount > 0 ? requiredCount - assignedCount : null;

  let statusBadge = null;
  if (requiredCount > 0) {
    if (diff > 0) statusBadge = { label: `残${diff}名`, cls: "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-300" };
    else if (diff === 0) statusBadge = { label: "充足", cls: "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/40 dark:border-green-700 dark:text-green-300" };
    else statusBadge = { label: `超過${Math.abs(diff)}名`, cls: "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/40 dark:border-red-700 dark:text-red-300" };
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors"
      onDragOver={onDragOver} onDrop={onDrop}>
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/60 bg-muted/20 select-none">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color || "#6366f1" }} />
        <span className="text-xs font-semibold text-foreground">{pos.name}</span>
        {onRequiredCountChange && isAdmin ? (
          <div className="flex items-center border border-border/60 rounded overflow-hidden bg-background ml-1">
            <button type="button" onClick={() => onRequiredCountChange(Math.max(0, requiredCount - 1))}
              className="w-4 h-4 flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground"><Minus className="w-2 h-2" /></button>
            <span className="w-5 text-[10px] text-center leading-4">{requiredCount}</span>
            <button type="button" onClick={() => onRequiredCountChange(requiredCount + 1)}
              className="w-4 h-4 flex items-center justify-center bg-muted hover:bg-muted/80 text-muted-foreground"><Plus className="w-2 h-2" /></button>
          </div>
        ) : (
          <span className="text-[10px] text-muted-foreground">{assignedCount}名{requiredCount > 0 ? `/${requiredCount}名` : ""}</span>
        )}
        {onRequiredCountChange && isAdmin && <span className="text-[10px] text-muted-foreground">{assignedCount}名配置</span>}
        {statusBadge && <span className={`text-[10px] font-semibold px-1 py-0.5 rounded border ${statusBadge.cls}`}>{statusBadge.label}</span>}
        {pos.notes && <span className="text-[10px] text-muted-foreground truncate flex-1">{pos.notes}</span>}
        {(onEdit || onDelete) && (
          <div className="flex gap-1 ml-auto flex-shrink-0">
            {onEdit && <button onClick={() => onEdit(pos)} disabled={!isAdmin} className="p-1 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"><Pencil className="w-3 h-3" /></button>}
            {onDelete && <button onClick={() => onDelete(pos.id)} disabled={!isAdmin} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"><Trash2 className="w-3 h-3" /></button>}
          </div>
        )}
      </div>

      <div className="divide-y divide-border/40">
        {staffNames.length > 0 ? staffNames.map((name, i) => {
          const staffData = staffList.find((s) => s.name === name);
          return (
            <div key={draggable ? `${pos.id}-${name}` : i}
              draggable={draggable && isAdmin}
              onDragStart={draggable && isAdmin && onStaffDragStart ? (e) => onStaffDragStart(e, name, pos.id) : undefined}
              className={["flex items-center justify-between gap-2 px-2 py-0.5 select-none",
                draggable && isAdmin ? "cursor-move hover:bg-muted/50" : "",
                draggable && draggedStaff === name ? "opacity-50" : ""].join(" ")}>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-foreground">{name}</span>
                {staffData?.note && <span className="text-[10px] text-muted-foreground ml-1.5">({staffData.note})</span>}
              </div>
              {onStaffRemove && isAdmin && (
                <button onClick={() => onStaffRemove(pos.id, name)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        }) : (
          <div className="px-2 py-0.5 text-[11px] text-muted-foreground">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

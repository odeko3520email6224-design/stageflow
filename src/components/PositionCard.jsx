import { Pencil, Trash2 } from "lucide-react";
import { TIME_SLOT_STYLES } from "@/lib/constants";

export default function PositionCard({
  pos,
  isAdmin,
  draggable = false,
  draggedStaff = null,
  onEdit,
  onDelete,
  onDragOver,
  onDrop,
  onStaffDragStart,
  onStaffRemove,
  emptyLabel = "スタッフ未登録",
  staffList = [],
  requiredCount = 0,
}) {
  const staffNames = pos.staff_names || [];
  const assignedCount = staffNames.length;
  const remaining = requiredCount > 0 ? requiredCount - assignedCount : null;

  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* ポジションヘッダー */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/60 bg-muted/20 select-none">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color || "#6366f1" }} />
        <span className="text-xs font-semibold text-foreground">{pos.name || pos.role}</span>
        {/* 人数バッジ */}
        <span className="text-[10px] text-muted-foreground">{assignedCount}名</span>
        {remaining !== null && (
          <span className={`text-[10px] font-semibold px-1 py-0.5 rounded border ${remaining > 0 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-green-50 border-green-200 text-green-700"}`}>
            {remaining > 0 ? `残${remaining}名` : "充足"}
          </span>
        )}
        {pos.notes && <span className="text-[10px] text-muted-foreground truncate flex-1">{pos.notes}</span>}
        {(onEdit || onDelete) && (
          <div className="flex gap-1 ml-auto flex-shrink-0">
            {onEdit && (
              <button onClick={() => onEdit(pos)} disabled={!isAdmin} className="p-1 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none" title="編集">
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(pos.id)} disabled={!isAdmin} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none" title="削除">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* スタッフ行 */}
      <div className="divide-y divide-border/40">
        {staffNames.length > 0 ? (
          staffNames.map((name, i) => {
            const staffData = staffList.find((s) => s.name === name);
            return (
              <div
                key={draggable ? `${pos.id}-${name}` : i}
                draggable={draggable && isAdmin}
                onDragStart={draggable && isAdmin && onStaffDragStart ? (e) => onStaffDragStart(e, name, pos.id) : undefined}
                className={[
                  "flex items-center justify-between gap-2 px-2 py-1 select-none",
                  draggable && isAdmin ? "cursor-move hover:bg-muted/50" : "",
                  draggable && draggedStaff === name ? "opacity-50" : "",
                ].join(" ")}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-foreground">{name}</span>
                  {staffData?.note && <span className="text-[10px] text-muted-foreground ml-1.5">{staffData.note}</span>}
                </div>
                {onStaffRemove && isAdmin && (
                  <button onClick={() => onStaffRemove(pos.id, name)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors" title={`${name}を削除`}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="px-2 py-1 text-[11px] text-muted-foreground">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}
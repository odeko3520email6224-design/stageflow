import { Pencil, Trash2 } from "lucide-react";

/**
 * 共通ポジションカード
 * - StaffList（配置表）と StaffDragDropManager（ドラッグ配置表）で共有
 * - draggable=true のとき各スタッフ行がドラッグ可能になる
 * - onStaffDragStart / onStaffRemove は draggable 時のみ使用
 */
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
}) {
  const staffNames = pos.staff_names || [];

  return (
    <div
      className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/30 transition-colors"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* ポジションヘッダー */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/20">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color || "#6366f1" }} />
        <span className="text-xs font-medium text-foreground">{pos.name || pos.role}</span>
        {pos.notes && <span className="text-xs text-muted-foreground truncate flex-1">{pos.notes}</span>}
        {/* 編集・削除ボタン（配置表のみ） */}
        {(onEdit || onDelete) && (
          <div className="flex gap-1 ml-auto flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(pos)}
                disabled={!isAdmin}
                className="p-1 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(pos.id)}
                disabled={!isAdmin}
                className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* スタッフ行 */}
      <div className="divide-y divide-border/40">
        {staffNames.length > 0 ? (
          staffNames.map((name, i) => (
            <div
              key={draggable ? `${pos.id}-${name}` : i}
              draggable={draggable && isAdmin}
              onDragStart={
                draggable && isAdmin && onStaffDragStart
                  ? (e) => onStaffDragStart(e, name, pos.id)
                  : undefined
              }
              className={[
                "flex items-center justify-between gap-2 px-3 py-1.5",
                draggable && isAdmin ? "cursor-move hover:bg-muted/50" : "",
                draggable && draggedStaff === name ? "opacity-50" : "",
              ].join(" ")}
            >
              <span className="text-xs text-foreground">{name}</span>
              {onStaffRemove && isAdmin && (
                <button
                  onClick={() => onStaffRemove(pos.id, name)}
                  className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="px-3 py-2 text-xs text-muted-foreground">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}
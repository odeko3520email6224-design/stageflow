import { Pencil, Trash2 } from "lucide-react";
import { TIME_SLOT_STYLES } from "@/lib/constants";

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
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/60 bg-muted/20 select-none">
        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pos.color || "#6366f1" }} />
        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${TIME_SLOT_STYLES[pos.time_slot || "開場前"]?.badge || "bg-slate-100 border-slate-200 text-slate-700"}`}>
          {pos.name || pos.role}
        </span>
        {pos.notes && <span className="text-[10px] text-muted-foreground truncate flex-1">{pos.notes}</span>}
        {/* 編集・削除ボタン（配置表のみ） */}
        {(onEdit || onDelete) && (
          <div className="flex gap-1 ml-auto flex-shrink-0">
            {onEdit && (
              <button
                onClick={() => onEdit(pos)}
                disabled={!isAdmin}
                className="p-1 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="編集"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
               <button
                 onClick={() => onDelete(pos.id)}
                 disabled={!isAdmin}
                 className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                 title="削除"
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
                "flex items-center justify-between gap-2 px-2 py-1 select-none",
                draggable && isAdmin ? "cursor-move hover:bg-muted/50" : "",
                draggable && draggedStaff === name ? "opacity-50" : "",
              ].join(" ")}
            >
              <span className="text-xs text-foreground">{name}</span>
              {onStaffRemove && isAdmin && (
                 <button
                   onClick={() => onStaffRemove(pos.id, name)}
                   className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                   title={`${name}を削除`}
                 >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="px-2 py-1 text-[11px] text-muted-foreground">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}
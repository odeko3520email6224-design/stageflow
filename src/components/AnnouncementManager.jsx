import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Bell, Plus, Trash2, Users, CheckCircle2, Clock, AlertTriangle,
  ShieldAlert, Send, X, Eye, ChevronDown, ChevronUp, Megaphone
} from "lucide-react";

const PRIORITY_STYLES = {
  "通常": { badge: "bg-blue-100 text-blue-700 border-blue-200", icon: Bell },
  "重要": { badge: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  "緊急": { badge: "bg-red-100 text-red-700 border-red-200", icon: ShieldAlert },
};

function AnnouncementForm({ eventId, staffList, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: "", body: "", priority: "通常", target_staff: [], is_alert: false,
  });
  const [allStaff, setAllStaff] = useState(true);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Announcement.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", eventId] });
      queryClient.invalidateQueries({ queryKey: ["announcements-alert", eventId] });
      onSaved();
    },
  });

  const toggleStaff = (name) => {
    setForm((prev) => ({
      ...prev,
      target_staff: prev.target_staff.includes(name)
        ? prev.target_staff.filter((n) => n !== name)
        : [...prev.target_staff, name],
    }));
  };

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    createMutation.mutate({
      ...form,
      event_id: eventId,
      target_staff: allStaff ? [] : form.target_staff,
      read_by: [],
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />連絡事項を作成
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Priority */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">優先度</label>
            <div className="flex gap-2">
              {["通常", "重要", "緊急"].map((p) => {
                const s = PRIORITY_STYLES[p];
                return (
                  <button
                    key={p}
                    onClick={() => setForm((prev) => ({ ...prev, priority: p }))}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      form.priority === p ? s.badge + " ring-2 ring-offset-1 ring-current" : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">件名 *</label>
            <input
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="例：入場ゲート変更のお知らせ"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          {/* Body */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">本文</label>
            <textarea
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="詳細内容を入力..."
              rows={3}
              value={form.body}
              onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            />
          </div>

          {/* Alert banner toggle */}
          <div
            onClick={() => setForm((prev) => ({ ...prev, is_alert: !prev.is_alert }))}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
              form.is_alert ? "bg-red-50 border-red-300" : "bg-muted border-border"
            }`}
          >
            <div className={`w-9 h-5 rounded-full flex items-center transition-all ${form.is_alert ? "bg-red-500" : "bg-slate-300"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_alert ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <div>
              <div className="text-xs font-semibold">アラートバナー表示</div>
              <div className="text-[10px] text-muted-foreground">ページ上部に緊急通知として表示</div>
            </div>
          </div>

          {/* Target staff */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">送信対象</label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setAllStaff(true)}
                className={`text-xs px-3 py-1 rounded-lg border ${allStaff ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground"}`}
              >
                全スタッフ
              </button>
              <button
                onClick={() => setAllStaff(false)}
                className={`text-xs px-3 py-1 rounded-lg border ${!allStaff ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground"}`}
              >
                個別指定
              </button>
            </div>
            {!allStaff && (
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-muted rounded-lg border border-border">
                {staffList.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => toggleStaff(s.name)}
                    className={`text-xs px-2 py-1 rounded-full border transition-all ${
                      form.target_staff.includes(s.name)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-foreground"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>キャンセル</Button>
          <Button
            className="flex-1 gap-1"
            disabled={!form.title.trim() || createMutation.isPending}
            onClick={handleSubmit}
          >
            <Send className="w-3.5 h-3.5" />送信
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnnouncementCard({ ann, staffList, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const queryClient = useQueryClient();

  const style = PRIORITY_STYLES[ann.priority] || PRIORITY_STYLES["通常"];
  const Icon = style.icon;
  const totalTargets = ann.target_staff?.length > 0 ? ann.target_staff.length : staffList.length;
  const readCount = (ann.read_by || []).length;
  const unreadCount = Math.max(0, totalTargets - readCount);

  const readMutation = useMutation({
    mutationFn: (name) => base44.entities.Announcement.update(ann.id, {
      read_by: [...new Set([...(ann.read_by || []), name])],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", ann.event_id] });
      queryClient.invalidateQueries({ queryKey: ["announcements-alert", ann.event_id] });
      setShowConfirm(false);
      setConfirmName("");
    },
  });

  const handleConfirm = () => {
    const name = confirmName.trim();
    if (!name) return;
    if ((ann.read_by || []).includes(name)) {
      setShowConfirm(false);
      setConfirmName("");
      return;
    }
    readMutation.mutate(name);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-start gap-2 px-3 py-2.5">
        <div className={`mt-0.5 p-1 rounded-lg border ${style.badge}`}>
          <Icon className="w-3 h-3" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${style.badge}`}>{ann.priority}</span>
            {ann.is_alert && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">バナー</span>
            )}
            <span className="text-xs font-semibold truncate">{ann.title}</span>
          </div>
          {ann.body && (
            <p className={`text-xs text-muted-foreground mt-0.5 ${expanded ? "" : "line-clamp-1"}`}>{ann.body}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-green-600">
              <CheckCircle2 className="w-3 h-3" />{readCount}名既読
            </span>
            {unreadCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-amber-600">
                <Clock className="w-3 h-3" />{unreadCount}名未読
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="w-3 h-3" />
              {ann.target_staff?.length > 0 ? `${ann.target_staff.length}名指定` : "全員"}
            </span>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setShowConfirm(!showConfirm)}
            className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
          >
            <CheckCircle2 className="w-3 h-3" />確認
          </button>
          {ann.body && (
            <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-muted text-muted-foreground">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={() => onDelete(ann.id)} className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Confirm read panel */}
      {showConfirm && (
        <div className="px-3 pb-3 border-t border-border/60 pt-2.5 bg-green-50/50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-green-800">自分の名前をタップして確認</p>
            <button onClick={() => setShowConfirm(false)} className="p-1 rounded hover:bg-muted text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {staffList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {staffList.map((s) => {
                const alreadyRead = (ann.read_by || []).includes(s.name);
                return (
                  <button
                    key={s.id}
                    onClick={() => !alreadyRead && readMutation.mutate(s.name)}
                    disabled={alreadyRead || readMutation.isPending}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-all ${
                      alreadyRead
                        ? "bg-green-100 text-green-700 border-green-200 cursor-default"
                        : "bg-card border-border text-foreground hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                    }`}
                  >
                    {alreadyRead && <CheckCircle2 className="w-3 h-3" />}
                    {s.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className="flex-1 border border-input rounded-lg px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="名前を入力"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              />
              <button
                onClick={handleConfirm}
                disabled={!confirmName.trim() || readMutation.isPending}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {readMutation.isPending ? "..." : "確認"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Read by detail */}
      {expanded && (ann.read_by || []).length > 0 && (
        <div className="px-3 pb-2.5 border-t border-border/60 pt-2">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Eye className="w-3 h-3" />既読者
          </p>
          <div className="flex flex-wrap gap-1">
            {ann.read_by.map((name) => (
              <span key={name} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">{name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnnouncementManager({ eventId }) {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff", eventId],
    queryFn: () => base44.entities.Staff.filter({ event_id: eventId }),
  });

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements", eventId],
    queryFn: () => base44.entities.Announcement.filter({ event_id: eventId }),
    select: (d) => d.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Announcement.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements", eventId] });
      queryClient.invalidateQueries({ queryKey: ["announcements-alert", eventId] });
    },
  });

  const urgentCount = announcements.filter((a) => {
    const total = a.target_staff?.length > 0 ? a.target_staff.length : staffList.length;
    return (a.read_by || []).length < total;
  }).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />連絡事項
          {urgentCount > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {urgentCount}件未読あり
            </span>
          )}
        </h2>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1 h-7 text-xs">
          <Plus className="w-3 h-3" />新規作成
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-14 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">連絡事項はありません</p>
          <p className="text-xs mt-1">「新規作成」でスタッフに連絡を送信できます</p>
        </div>
      ) : (
        <div className="space-y-2">
          {announcements.map((ann) => (
            <AnnouncementCard
              key={ann.id}
              ann={ann}
              staffList={staffList}
              onDelete={(id) => { if (confirm("削除しますか？")) deleteMutation.mutate(id); }}
            />
          ))}
        </div>
      )}

      {showForm && (
        <AnnouncementForm
          eventId={eventId}
          staffList={staffList}
          onClose={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}
    </div>
  );
}
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Map, Download, Save } from "lucide-react";

export default function MapTemplateManagement({ eventId }) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(null);
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["mapTemplates"],
    queryFn: () => base44.entities.MapTemplate.list("-created_date"),
  });

  const { data: currentAreas = [] } = useQuery({
    queryKey: ["mapareas", eventId],
    queryFn: () => base44.entities.MapArea.filter({ event_id: eventId }, "order"),
  });

  const deleteTemplate = useMutation({
    mutationFn: (id) => base44.entities.MapTemplate.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mapTemplates"] }),
  });

  // 現在のマップをテンプレートとして保存
  const handleSaveAsTemplate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const areasData = currentAreas.map(({ name, type, x, y, width, height, color, order }) => ({
      name, type, x, y, width, height, color, order,
    }));
    await base44.entities.MapTemplate.create({
      name: newName.trim(),
      areas: areasData,
    });
    queryClient.invalidateQueries({ queryKey: ["mapTemplates"] });
    setNewName("");
    setSaving(false);
  };

  // テンプレートを現在のイベントに適用（既存エリアを削除して上書き）
  const handleApply = async (template) => {
    if (!confirm(`「${template.name}」を現在のイベントに適用しますか？\n既存のマップエリアはすべて削除されます。`)) return;
    setApplying(template.id);

    // 既存エリア削除
    await Promise.all(currentAreas.map((a) => base44.entities.MapArea.delete(a.id)));

    // テンプレートのエリアを新規作成
    const createPromises = (template.areas || []).map((area, i) =>
      base44.entities.MapArea.create({ ...area, event_id: eventId, order: area.order ?? i })
    );
    await Promise.all(createPromises);

    queryClient.invalidateQueries({ queryKey: ["mapareas", eventId] });
    setApplying(null);
  };

  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="text-base font-bold flex items-center gap-2 mb-3">
        <Map className="w-4 h-4 text-primary" />
        会場マップテンプレート
      </h3>

      {/* 現在のマップをテンプレート保存 */}
      <div className="bg-card border border-border rounded-xl p-3 mb-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">現在のマップをテンプレートとして保存</p>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="テンプレート名（例：ホールA）"
            className="flex-1 h-8 text-sm"
          />
          <Button
            size="sm"
            className="gap-1 h-8 shrink-0"
            disabled={!newName.trim() || saving}
            onClick={handleSaveAsTemplate}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </div>
        {currentAreas.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5">現在 {currentAreas.length} エリア登録中</p>
        )}
      </div>

      {/* テンプレート一覧 */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Map className="w-10 h-10 mx-auto mb-2 opacity-20" />
          <p className="text-sm font-medium">テンプレートがありません</p>
          <p className="text-xs mt-1">会場マップを作成して保存してください</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{tpl.name}</p>
                <p className="text-[10px] text-muted-foreground">{(tpl.areas || []).length} エリア</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 h-7 text-xs shrink-0"
                disabled={applying === tpl.id}
                onClick={() => handleApply(tpl)}
              >
                <Download className="w-3 h-3" />
                {applying === tpl.id ? "適用中..." : "適用"}
              </Button>
              <button
                onClick={() => { if (confirm(`「${tpl.name}」を削除しますか？`)) deleteTemplate.mutate(tpl.id); }}
                className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
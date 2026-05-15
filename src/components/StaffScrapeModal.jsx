import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Download, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function StaffScrapeModal({ eventId, onClose }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const res = await base44.functions.invoke("scrapeStaffNames", { url: url.trim(), eventId });
    const data = res.data;

    if (data.error) {
      setError(data.error);
    } else {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["staff", eventId] });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-bold text-base flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" />
            点呼表からスタッフリストを取得
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">取得元URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/staff-page"
              className="text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) handleScrape();
              }}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              A-CAST 点呼表からスタッフリストを取得します。電話番号などの情報は収集しません。
            </p>
          </div>

          {/* Result */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <CheckCircle2 className="w-4 h-4" />
                取得完了
              </div>
              <p>{result.found}名を検出 → {result.added}名を追加（{result.skipped}名は重複スキップ）</p>
              {result.names?.length > 0 && (
                <div className="mt-2 text-xs text-green-700 max-h-32 overflow-y-auto space-y-0.5">
                  {result.names.map((name, i) => <div key={i}>・{name}</div>)}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <Button variant="outline" onClick={onClose} className="flex-1">キャンセル</Button>
          <Button onClick={handleScrape} disabled={!url.trim() || loading} className="flex-1 gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {loading ? "取得中..." : "点呼表から取得"}
          </Button>
        </div>
      </div>
    </div>
  );
}
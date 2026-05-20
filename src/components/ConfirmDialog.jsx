import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel = "削除", confirmVariant = "destructive" }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-2" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-4">
        <div className="flex items-start gap-2 mb-3">
          <div className="p-2 rounded-full bg-destructive/10 shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <p className="text-sm text-foreground leading-relaxed pt-1 whitespace-pre-line">{message}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>キャンセル</Button>
          <Button
            className="flex-1"
            variant={confirmVariant}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

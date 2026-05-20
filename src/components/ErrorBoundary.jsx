import { Component } from "react";
import { AlertTriangle } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(this.props.label || "UI error", error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold">{this.props.title || "表示中にエラーが発生しました"}</p>
            <p className="mt-1 text-xs break-words">{this.state.error?.message || "画面を再読み込みしてください。"}</p>
          </div>
        </div>
      </div>
    );
  }
}

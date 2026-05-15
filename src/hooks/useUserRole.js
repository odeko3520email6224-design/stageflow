import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Returns the current user's role: "admin" | "chief" | "user" | null (loading)
 * isAdmin: role === "admin" (ユーザー管理・設定変更も含む全権限)
 * isChief: role === "chief" (設定変更・ユーザー管理以外の全操作可能)
 * canEdit: admin or chief (配置表・スタッフ管理等の編集権限)
 * canManageSettings: admin only (ポジション設定・プリセット・イベント設定)
 */
export function useUserRole() {
  const [role, setRole] = useState(null); // null = loading

  useEffect(() => {
    base44.auth.me().then((user) => {
      setRole(user?.role || "user");
    }).catch(() => setRole("user"));
  }, []);

  return {
    role,
    isAdmin: role === "admin",
    isChief: role === "chief",
    canEdit: role === "admin" || role === "chief",
    canManageSettings: role === "admin",
  };
}
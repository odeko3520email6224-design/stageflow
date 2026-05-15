import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Returns the current user's role: "admin" | "chief" | "user" | null (loading)
 * 全てのロールで読み取り・編集が可能です
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
    canEdit: true,
    canManageSettings: true,
  };
}
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Returns the current user's role and permission flags.
 * admin / chief = full access
 * user = read-only (view only)
 */
export function useUserRole() {
  const [role, setRole] = useState(null); // null = loading

  useEffect(() => {
    base44.auth.me().then((user) => {
      setRole(user?.role || "user");
    }).catch(() => setRole("user"));
  }, []);

  const isAdmin = role === "admin";
  const isChief = role === "chief";
  const canEdit = isAdmin || isChief;
  const canManageSettings = isAdmin || isChief;

  return {
    role,
    isAdmin,
    isChief,
    canEdit,
    canManageSettings,
  };
}
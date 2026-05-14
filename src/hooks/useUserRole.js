import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Returns the current user's role: "admin" | "user" | null (loading) | false (error)
 * isAdmin: role === "admin"
 * canEdit: role === "admin"  (user role is read-only except Announcements)
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
    canEdit: true,
  };
}
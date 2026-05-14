import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(null); // null = loading

  useEffect(() => {
    base44.auth.me().then((user) => {
      setIsAdmin(user?.role === "admin");
    }).catch(() => setIsAdmin(false));
  }, []);

  return isAdmin;
}
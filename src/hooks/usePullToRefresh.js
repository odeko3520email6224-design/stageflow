import { useState, useEffect } from "react";

export function usePullToRefresh(onRefresh) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = { current: null };

  useEffect(() => {
    const handleTouchStart = (e) => {
      const scrollTop = window.scrollY;
      if (scrollTop === 0) {
        startYRef.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (startYRef.current === null) return;
      const diff = e.touches[0].clientY - startYRef.current;
      if (diff > 0) {
        setIsPulling(true);
        setPullDistance(Math.min(diff, 100));
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 60) {
        setIsPulling(true);
        await onRefresh();
      }
      startYRef.current = null;
      setIsPulling(false);
      setPullDistance(0);
    };

    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, onRefresh]);

  return { isPulling, pullDistance };
}
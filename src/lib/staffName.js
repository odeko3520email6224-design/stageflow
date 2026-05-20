export function getPublicStaffName(name) {
  const text = String(name || "").trim();
  if (!text) return "";
  return text.split(/[\s\u3000]+/)[0] || text;
}

export function getStaffDisplayName(name, shouldMask = false) {
  return shouldMask ? getPublicStaffName(name) : String(name || "");
}

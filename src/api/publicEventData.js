import { base44 } from "@/api/base44Client";

export const publicEventDataKey = (eventId) => ["publicEventData", eventId];

export async function fetchPublicEventData(eventId) {
  const response = await base44.functions.invoke("publicEvents", { action: "data", eventId });
  if (response.data?.error) throw new Error(response.data.error);
  return response.data || {};
}

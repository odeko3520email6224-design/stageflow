import { base44 } from "@/api/base44Client";

export const EVENT_MODE_REFETCH_INTERVAL = 3000;

export async function loadEventById(eventId) {
  try {
    return await base44.entities.Event.get(eventId);
  } catch {
    const events = await base44.entities.Event.filter({ id: eventId });
    return events?.[0] || null;
  }
}

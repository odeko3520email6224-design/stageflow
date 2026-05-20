import { base44 } from "@/api/base44Client";

export async function fetchPublicEvents() {
  const response = await base44.functions.invoke("publicEvents", {});
  if (response.data?.error) throw new Error(response.data.error);
  return response.data?.events || [];
}

export async function fetchPublicEventData(eventId) {
  const response = await base44.functions.invoke("publicEventData", { eventId });
  if (response.data?.error) throw new Error(response.data.error);
  return response.data || {};
}

export async function fetchPublicEvent(eventId) {
  const data = await fetchPublicEventData(eventId);
  return data.event;
}

export async function fetchPublicStaff(eventId) {
  const data = await fetchPublicEventData(eventId);
  return data.staff || [];
}

export async function fetchPublicPositions(eventId) {
  const data = await fetchPublicEventData(eventId);
  return data.positions || [];
}

export async function fetchPublicAnnouncements(eventId) {
  const data = await fetchPublicEventData(eventId);
  return data.announcements || [];
}

export async function fetchPublicTasks(eventId) {
  const data = await fetchPublicEventData(eventId);
  return data.tasks || [];
}

export async function fetchPublicPositionTypes(eventId) {
  const data = await fetchPublicEventData(eventId);
  return data.positionTypes || [];
}

export async function fetchPublicPositionPresets(eventId) {
  const data = await fetchPublicEventData(eventId);
  return data.positionPresets || [];
}

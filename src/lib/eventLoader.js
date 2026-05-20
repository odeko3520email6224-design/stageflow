import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";

export const EVENT_MODE_REFETCH_INTERVAL = 3000;
export const EVENT_MODE_TEMPLATE_PREFIX = "__event_modes__";
export const EVENT_MODE_FIELDS = ["staff_management_mode", "assignment_mode", "venue_map_mode"];

function getEventModeTemplateName(eventId) {
  return `${EVENT_MODE_TEMPLATE_PREFIX}:${eventId}`;
}

function getNewestTemplate(records, name) {
  return (records || [])
    .filter((item) => item.name === name)
    .sort((a, b) => {
      const aDate = new Date(a.updated_date || a.created_date || 0).getTime();
      const bDate = new Date(b.updated_date || b.created_date || 0).getTime();
      return bDate - aDate;
    })[0] || null;
}

function normalizeEventModes(raw) {
  const source = raw?.modes || raw || {};
  return EVENT_MODE_FIELDS.reduce((acc, field) => {
    if (source[field] === "public" || source[field] === "edit") acc[field] = source[field];
    return acc;
  }, {});
}

async function loadEventModeTemplateFromRest(eventId) {
  if (!appParams.appId) return null;
  const response = await fetch(`/api/apps/${appParams.appId}/entities/MapTemplate`);
  if (!response.ok) throw new Error(`MapTemplate request failed: ${response.status}`);
  const records = await response.json();
  return getNewestTemplate(records, getEventModeTemplateName(eventId));
}

async function loadEventModeSettings(eventId) {
  const name = getEventModeTemplateName(eventId);
  try {
    const restRecord = await loadEventModeTemplateFromRest(eventId);
    if (restRecord) return normalizeEventModes(restRecord?.areas?.[0]);
  } catch (error) {
    console.warn("Event mode settings REST read failed; trying SDK.", error);
  }

  const [filteredResult, listResult] = await Promise.allSettled([
    base44.entities.MapTemplate.filter({ name }),
    base44.entities.MapTemplate.list(),
  ]);
  const fromFilter = filteredResult.status === "fulfilled" ? getNewestTemplate(filteredResult.value, name) : null;
  const fromList = listResult.status === "fulfilled" ? getNewestTemplate(listResult.value, name) : null;
  return normalizeEventModes((fromFilter || fromList)?.areas?.[0]);
}

export async function loadEventById(eventId) {
  let event = null;
  try {
    event = await base44.entities.Event.get(eventId);
  } catch {
    const events = await base44.entities.Event.filter({ id: eventId });
    event = events?.[0] || null;
  }
  if (!event) return null;
  const modes = await loadEventModeSettings(eventId);
  return { ...event, ...modes };
}

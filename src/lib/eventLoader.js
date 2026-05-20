import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import { LIVE_SYNC_INTERVAL } from "@/lib/liveSync";

export const EVENT_MODE_REFETCH_INTERVAL = LIVE_SYNC_INTERVAL;
export const EVENT_MODE_TEMPLATE_PREFIX = "__event_modes__";
export const EVENT_MODE_FIELDS = ["staff_management_mode", "assignment_mode", "venue_map_mode"];

const eventModeCache = new Map();

function getEventModeTemplateName(eventId) {
  return `${EVENT_MODE_TEMPLATE_PREFIX}:${eventId}`;
}

function getEventModeCacheKey(eventId) {
  return `stageflow:event_modes:${eventId}`;
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

function readCachedEventModes(eventId) {
  const inMemory = eventModeCache.get(eventId);
  if (inMemory) return inMemory;
  if (typeof window === "undefined") return {};
  try {
    const cached = JSON.parse(window.localStorage.getItem(getEventModeCacheKey(eventId)) || "{}");
    const modes = normalizeEventModes(cached);
    if (Object.keys(modes).length > 0) {
      eventModeCache.set(eventId, modes);
      return modes;
    }
  } catch {
    // Ignore corrupt local cache and fall back to server data.
  }
  return {};
}

function rememberEventModes(eventId, modes) {
  const normalized = normalizeEventModes(modes);
  if (Object.keys(normalized).length === 0) return normalized;
  const merged = {
    ...readCachedEventModes(eventId),
    ...normalized,
  };
  eventModeCache.set(eventId, merged);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(getEventModeCacheKey(eventId), JSON.stringify(merged));
    } catch {
      // Storage may be unavailable in private contexts; in-memory cache is enough for this session.
    }
  }
  return merged;
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
    if (restRecord) return rememberEventModes(eventId, restRecord?.areas?.[0]);
  } catch (error) {
    console.warn("Event mode settings REST read failed; trying SDK.", error);
  }

  try {
    const [filteredResult, listResult] = await Promise.allSettled([
      base44.entities.MapTemplate.filter({ name }),
      base44.entities.MapTemplate.list(),
    ]);
    const fromFilter = filteredResult.status === "fulfilled" ? getNewestTemplate(filteredResult.value, name) : null;
    const fromList = listResult.status === "fulfilled" ? getNewestTemplate(listResult.value, name) : null;
    const record = fromFilter || fromList;
    if (record) return rememberEventModes(eventId, record?.areas?.[0]);
  } catch (error) {
    console.warn("Event mode settings SDK read failed; using cached modes.", error);
  }
  return readCachedEventModes(eventId);
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

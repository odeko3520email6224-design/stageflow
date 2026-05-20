import { appParams } from "@/lib/app-params";

export const POSITION_SIDE_TEMPLATE_PREFIX = "__position_side__";

export function getPositionSideTemplateName(eventId) {
  return `${POSITION_SIDE_TEMPLATE_PREFIX}:${eventId}`;
}

export function normalizePositionSideSettings(raw) {
  return {
    position_types: raw?.position_types || {},
    positions: raw?.positions || {},
    updated_at: raw?.updated_at || null,
  };
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

async function loadPositionSideSettingsFromRest(eventId) {
  if (!appParams.appId) return null;
  const response = await fetch(`/api/apps/${appParams.appId}/entities/MapTemplate`);
  if (!response.ok) throw new Error(`MapTemplate request failed: ${response.status}`);
  const records = await response.json();
  return getNewestTemplate(records, getPositionSideTemplateName(eventId));
}

export async function loadPositionSideSettings(base44, eventId) {
  const name = getPositionSideTemplateName(eventId);
  try {
    const restRecord = await loadPositionSideSettingsFromRest(eventId);
    if (restRecord) return normalizePositionSideSettings(restRecord?.areas?.[0]);
  } catch (error) {
    console.warn("Position side settings REST read failed; trying SDK.", error);
  }

  const [filteredResult, listResult] = await Promise.allSettled([
    base44.entities.MapTemplate.filter({ name }),
    base44.entities.MapTemplate.list(),
  ]);
  const fromFilter = filteredResult.status === "fulfilled" ? getNewestTemplate(filteredResult.value, name) : null;
  const fromList = listResult.status === "fulfilled"
    ? getNewestTemplate(listResult.value, name)
    : null;
  return normalizePositionSideSettings((fromFilter || fromList)?.areas?.[0]);
}

export function applyPositionSideMutation(settings, positionId, data) {
  const previous = normalizePositionSideSettings(settings);
  const current = previous.positions[positionId] || {};
  const splitBySide = Boolean(data.split_by_side ?? current.split_by_side);
  const kamite = data.staff_names_kamite ?? current.staff_names_kamite ?? [];
  const shimote = data.staff_names_shimote ?? current.staff_names_shimote ?? [];
  return {
    ...previous,
    positions: {
      ...previous.positions,
      [positionId]: {
        ...current,
        split_by_side: splitBySide,
        staff_names_kamite: kamite,
        staff_names_shimote: shimote,
      },
    },
    updated_at: new Date().toISOString(),
  };
}

export function applyPositionSideSettingsToTypes(positionTypes, settings) {
  const typeSettings = settings?.position_types || {};
  return (positionTypes || []).map((pt) => ({
    ...pt,
    split_by_side: Boolean(typeSettings[pt.name]),
  }));
}

export function applyPositionSideSettingsToPositions(positions, positionTypes, settings) {
  const typeSettings = settings?.position_types || {};
  const positionSettings = settings?.positions || {};
  return (positions || []).map((position) => {
    const saved = positionSettings[position.id] || {};
    const splitByType = Boolean(typeSettings[position.name]);
    const splitBySide = Boolean(saved.split_by_side ?? splitByType);
    return {
      ...position,
      split_by_side: splitBySide,
      staff_names_kamite: saved.staff_names_kamite || [],
      staff_names_shimote: saved.staff_names_shimote || [],
    };
  });
}

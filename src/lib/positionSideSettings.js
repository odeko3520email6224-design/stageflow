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

export async function loadPositionSideSettings(base44, eventId) {
  const name = getPositionSideTemplateName(eventId);
  const [filteredResult, listResult] = await Promise.allSettled([
    base44.entities.MapTemplate.filter({ name }),
    base44.entities.MapTemplate.list(),
  ]);
  const fromFilter = filteredResult.status === "fulfilled" ? filteredResult.value?.[0] : null;
  const fromList = listResult.status === "fulfilled"
    ? listResult.value?.find((item) => item.name === name)
    : null;
  return normalizePositionSideSettings((fromFilter || fromList)?.areas?.[0]);
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

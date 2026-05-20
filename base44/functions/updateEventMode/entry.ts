import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_FIELDS = new Set(['staff_management_mode', 'assignment_mode', 'venue_map_mode']);
const ALLOWED_MODES = new Set(['public', 'edit']);
const MODE_TEMPLATE_PREFIX = '__event_modes__';

async function loadModeTemplate(base44: any, eventId: string) {
  const name = `${MODE_TEMPLATE_PREFIX}:${eventId}`;
  let records = await base44.asServiceRole.entities.MapTemplate.filter({ name });
  if (!records?.length) {
    const allRecords = await base44.asServiceRole.entities.MapTemplate.list();
    records = allRecords?.filter((item: Record<string, any>) => item.name === name) || [];
  }
  const record = records
    ?.sort((a: Record<string, any>, b: Record<string, any>) => {
      const aDate = new Date(a.updated_date || a.created_date || 0).getTime();
      const bDate = new Date(b.updated_date || b.created_date || 0).getTime();
      return bDate - aDate;
    })?.[0] || null;
  return {
    record,
    name,
    data: record?.areas?.[0] || {},
  };
}

async function saveModeTemplate(base44: any, eventId: string, field: string, mode: string) {
  const template = await loadModeTemplate(base44, eventId);
  const previousModes = template.data?.modes || {};
  const modes = {
    ...previousModes,
    [field]: mode,
  };
  const payload = {
    name: template.name,
    description: 'StageFlow event visibility modes',
    areas: [{
      ...template.data,
      modes,
      [field]: mode,
      updated_at: new Date().toISOString(),
    }],
  };
  const record = template.record?.id
    ? await base44.asServiceRole.entities.MapTemplate.update(template.record.id, payload)
    : await base44.asServiceRole.entities.MapTemplate.create(payload);
  return { modes, record };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!['admin', 'chief'].includes(user.role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { eventId, field, mode } = await req.json();
    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }
    if (!ALLOWED_FIELDS.has(field) || !ALLOWED_MODES.has(mode)) {
      return Response.json({ error: 'invalid mode update' }, { status: 400 });
    }

    let event = null;
    let eventUpdateError = null;
    try {
      event = await base44.asServiceRole.entities.Event.update(eventId, {
        [field]: mode,
      });
    } catch (error) {
      eventUpdateError = error;
    }

    const modeTemplate = await saveModeTemplate(base44, eventId, field, mode);

    return Response.json({
      event: { ...(event || {}), id: eventId, ...modeTemplate.modes, [field]: mode },
      modeSettings: modeTemplate.modes,
      eventUpdateWarning: eventUpdateError?.message || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ALLOWED_FIELDS = new Set(['assignment_mode', 'venue_map_mode']);
const ALLOWED_MODES = new Set(['public', 'edit']);

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

    const event = await base44.asServiceRole.entities.Event.update(eventId, {
      [field]: mode,
    });

    return Response.json({ event: { ...(event || {}), id: eventId, [field]: mode } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

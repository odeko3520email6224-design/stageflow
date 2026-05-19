import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'list';

    if (action === 'get') {
      if (!body.eventId) {
        return Response.json({ error: 'eventId required' }, { status: 400 });
      }
      const event = await base44.asServiceRole.entities.Event.get(body.eventId);
      return Response.json({ event });
    }

    if (action === 'data') {
      if (!body.eventId) {
        return Response.json({ error: 'eventId required' }, { status: 400 });
      }
      const [
        event,
        staff,
        positions,
        announcements,
        positionTypes,
        positionPresets,
      ] = await Promise.all([
        base44.asServiceRole.entities.Event.get(body.eventId),
        base44.asServiceRole.entities.Staff.filter({ event_id: body.eventId }),
        base44.asServiceRole.entities.Position.filter({ event_id: body.eventId }),
        base44.asServiceRole.entities.Announcement.filter({ event_id: body.eventId }),
        base44.asServiceRole.entities.PositionType.list(),
        base44.asServiceRole.entities.PositionPreset.list(),
      ]);

      return Response.json({
        event,
        staff,
        positions,
        announcements,
        positionTypes,
        positionPresets,
      });
    }

    const events = await base44.asServiceRole.entities.Event.list('-created_date');
    return Response.json({ events });
  } catch (error) {
    console.error('Public events error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

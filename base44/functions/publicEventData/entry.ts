import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { eventId } = await req.json().catch(() => ({}));
    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    const [
      event,
      staff,
      positions,
      announcements,
      tasks,
      positionTypes,
      positionPresets,
      mapAreas,
    ] = await Promise.all([
      base44.asServiceRole.entities.Event.get(eventId),
      base44.asServiceRole.entities.Staff.filter({ event_id: eventId }),
      base44.asServiceRole.entities.Position.filter({ event_id: eventId }),
      base44.asServiceRole.entities.Announcement.filter({ event_id: eventId }),
      base44.asServiceRole.entities.Task.filter({ event_id: eventId }, 'order'),
      base44.asServiceRole.entities.PositionType.list(),
      base44.asServiceRole.entities.PositionPreset.list(),
      base44.asServiceRole.entities.MapArea.filter({ event_id: eventId }, 'order'),
    ]);

    return Response.json({
      event,
      staff,
      positions,
      announcements,
      tasks,
      positionTypes,
      positionPresets,
      mapAreas,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

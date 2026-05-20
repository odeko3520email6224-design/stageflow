import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const safeRead = async (reader, fallback) => {
  try {
    return await reader();
  } catch {
    return fallback;
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { eventId } = await req.json().catch(() => ({}));
    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    const [
      events,
      staff,
      positions,
      announcements,
      tasks,
      positionTypes,
      positionPresets,
      mapAreas,
    ] = await Promise.all([
      safeRead(() => base44.asServiceRole.entities.Event.filter({ id: eventId }), []),
      safeRead(() => base44.asServiceRole.entities.Staff.filter({ event_id: eventId }), []),
      safeRead(() => base44.asServiceRole.entities.Position.filter({ event_id: eventId }), []),
      safeRead(() => base44.asServiceRole.entities.Announcement.filter({ event_id: eventId }), []),
      safeRead(() => base44.asServiceRole.entities.Task.filter({ event_id: eventId }, 'order'), []),
      safeRead(() => base44.asServiceRole.entities.PositionType.list(), []),
      safeRead(() => base44.asServiceRole.entities.PositionPreset.list(), []),
      safeRead(() => base44.asServiceRole.entities.MapArea.filter({ event_id: eventId }, 'order'), []),
    ]);
    const event = events[0] || null;

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

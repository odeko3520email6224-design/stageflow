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
        tasks,
        positionTypes,
        positionPresets,
      ] = await Promise.all([
        base44.asServiceRole.entities.Event.get(body.eventId),
        base44.asServiceRole.entities.Staff.filter({ event_id: body.eventId }),
        base44.asServiceRole.entities.Position.filter({ event_id: body.eventId }),
        base44.asServiceRole.entities.Announcement.filter({ event_id: body.eventId }),
        base44.asServiceRole.entities.Task.filter({ event_id: body.eventId }, 'order'),
        base44.asServiceRole.entities.PositionType.list(),
        base44.asServiceRole.entities.PositionPreset.list(),
      ]);

      return Response.json({
        event,
        staff,
        positions,
        announcements,
        tasks,
        positionTypes,
        positionPresets,
      });
    }

    if (action === 'createAnnouncement') {
      const announcement = await base44.asServiceRole.entities.Announcement.create(body.data);
      return Response.json({ announcement });
    }

    if (action === 'updateAnnouncement') {
      if (!body.id) {
        return Response.json({ error: 'id required' }, { status: 400 });
      }
      const announcement = await base44.asServiceRole.entities.Announcement.update(body.id, body.data);
      return Response.json({ announcement });
    }

    if (action === 'deleteAnnouncement') {
      if (!body.id) {
        return Response.json({ error: 'id required' }, { status: 400 });
      }
      await base44.asServiceRole.entities.Announcement.delete(body.id);
      return Response.json({ ok: true });
    }

    if (action === 'createStaff') {
      const staff = await base44.asServiceRole.entities.Staff.create(body.data);
      return Response.json({ staff });
    }

    if (action === 'updateStaff') {
      if (!body.id) {
        return Response.json({ error: 'id required' }, { status: 400 });
      }
      const staff = await base44.asServiceRole.entities.Staff.update(body.id, body.data);
      return Response.json({ staff });
    }

    if (action === 'deleteStaff') {
      if (!body.id || !body.eventId) {
        return Response.json({ error: 'id and eventId required' }, { status: 400 });
      }
      const staffToDelete = await base44.asServiceRole.entities.Staff.get(body.id);
      await base44.asServiceRole.entities.Staff.delete(body.id);

      if (staffToDelete?.name) {
        const positions = await base44.asServiceRole.entities.Position.filter({ event_id: body.eventId });
        const affected = positions.filter((p) => (p.staff_names || []).includes(staffToDelete.name));
        await Promise.all(
          affected.map((p) =>
            base44.asServiceRole.entities.Position.update(p.id, {
              staff_names: (p.staff_names || []).filter((name) => name !== staffToDelete.name),
            })
          )
        );
      }

      return Response.json({ ok: true });
    }

    if (action === 'updateChief') {
      if (!body.eventId) {
        return Response.json({ error: 'eventId required' }, { status: 400 });
      }
      const event = await base44.asServiceRole.entities.Event.update(body.eventId, {
        chief_staff_name: body.chief_staff_name || '',
      });
      return Response.json({ event });
    }

    if (action === 'listTasks') {
      if (!body.eventId) {
        return Response.json({ error: 'eventId required' }, { status: 400 });
      }
      const tasks = await base44.asServiceRole.entities.Task.filter({ event_id: body.eventId }, 'order');
      return Response.json({ tasks });
    }

    if (action === 'createTask') {
      const task = await base44.asServiceRole.entities.Task.create(body.data);
      return Response.json({ task });
    }

    if (action === 'updateTask') {
      if (!body.id) {
        return Response.json({ error: 'id required' }, { status: 400 });
      }
      const task = await base44.asServiceRole.entities.Task.update(body.id, body.data);
      return Response.json({ task });
    }

    if (action === 'deleteTask') {
      if (!body.id) {
        return Response.json({ error: 'id required' }, { status: 400 });
      }
      await base44.asServiceRole.entities.Task.delete(body.id);
      return Response.json({ ok: true });
    }

    const events = await base44.asServiceRole.entities.Event.list('-created_date');
    return Response.json({ events });
  } catch (error) {
    console.error('Public events error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

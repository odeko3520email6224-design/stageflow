import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId, chief_staff_name } = await req.json();
    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    const event = await base44.asServiceRole.entities.Event.update(eventId, {
      chief_staff_name: chief_staff_name || '',
    });

    return Response.json({ event });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

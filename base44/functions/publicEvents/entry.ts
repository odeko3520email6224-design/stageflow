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

    const events = await base44.asServiceRole.entities.Event.list('-created_date');
    return Response.json({ events });
  } catch (error) {
    console.error('Public events error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

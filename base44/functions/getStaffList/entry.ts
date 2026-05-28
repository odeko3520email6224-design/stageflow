import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { eventId } = await req.json();

    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    const staff = await base44.asServiceRole.entities.Staff.filter({ event_id: eventId });
    return Response.json({ staff: staff || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
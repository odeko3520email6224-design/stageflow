import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

    const { eventId, map_pdf_url = null, map_image_url = null } = await req.json();
    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    const event = await base44.asServiceRole.entities.Event.update(eventId, {
      map_pdf_url,
      map_image_url,
    });

    return Response.json({
      event: {
        ...(event || {}),
        id: eventId,
        map_pdf_url,
        map_image_url,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

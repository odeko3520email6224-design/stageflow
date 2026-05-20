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

    const data = {
      map_pdf_url,
      map_image_url,
    };
    let event = null;
    try {
      event = await base44.asServiceRole.entities.Event.update(eventId, data);
    } catch (eventError) {
      console.warn('Event venue map field update failed:', eventError.message);
    }

    const existingAssets = await base44.asServiceRole.entities.VenueMapAsset.filter({ event_id: eventId });
    const assetPayload = {
      event_id: eventId,
      ...data,
      updated_at: new Date().toISOString(),
    };
    const asset = existingAssets?.[0]
      ? await base44.asServiceRole.entities.VenueMapAsset.update(existingAssets[0].id, assetPayload)
      : await base44.asServiceRole.entities.VenueMapAsset.create(assetPayload);

    return Response.json({
      event: {
        ...(event || {}),
        id: eventId,
        map_pdf_url,
        map_image_url,
      },
      asset: {
        ...(asset || {}),
        ...assetPayload,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

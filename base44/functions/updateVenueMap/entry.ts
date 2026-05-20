import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FALLBACK_TEMPLATE_PREFIX = '__venue_map_asset__';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const hasApiKey = Boolean(req.headers.get('api_key'));
    if (!hasApiKey) {
      const user = await base44.auth.me();
      if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!['admin', 'chief'].includes(user.role)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
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
    const persistenceErrors: string[] = [];
    try {
      event = await base44.asServiceRole.entities.Event.update(eventId, data);
    } catch (eventError) {
      console.warn('Event venue map field update failed:', eventError.message);
      persistenceErrors.push(`Event: ${eventError.message}`);
    }

    const assetPayload = {
      event_id: eventId,
      ...data,
      updated_at: new Date().toISOString(),
    };
    let asset = null;
    let fallback = null;
    try {
      const existingAssets = await base44.asServiceRole.entities.VenueMapAsset.filter({ event_id: eventId });
      asset = existingAssets?.[0]
        ? await base44.asServiceRole.entities.VenueMapAsset.update(existingAssets[0].id, assetPayload)
        : await base44.asServiceRole.entities.VenueMapAsset.create(assetPayload);
    } catch (assetError) {
      console.warn('VenueMapAsset update failed:', assetError.message);
      persistenceErrors.push(`VenueMapAsset: ${assetError.message}`);
    }

    try {
      const fallbackName = `${FALLBACK_TEMPLATE_PREFIX}:${eventId}`;
      let existingFallbacks = await base44.asServiceRole.entities.MapTemplate.filter({ name: fallbackName });
      if (!existingFallbacks?.length) {
        const allFallbacks = await base44.asServiceRole.entities.MapTemplate.list();
        existingFallbacks = allFallbacks?.filter((item: Record<string, any>) => item.name === fallbackName) || [];
      }
      const fallbackPayload = {
        name: fallbackName,
        description: 'StageFlow venue map asset fallback',
        areas: [assetPayload],
      };
      fallback = existingFallbacks?.[0]
        ? await base44.asServiceRole.entities.MapTemplate.update(existingFallbacks[0].id, fallbackPayload)
        : await base44.asServiceRole.entities.MapTemplate.create(fallbackPayload);
    } catch (fallbackError) {
      console.warn('Venue map fallback update failed:', fallbackError.message);
      persistenceErrors.push(`MapTemplate fallback: ${fallbackError.message}`);
    }

    if (!event && !asset && !fallback) {
      return Response.json({
        error: 'Venue map could not be persisted',
        details: persistenceErrors,
      }, { status: 500 });
    }

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
      fallback: fallback || null,
      persisted: {
        event: Boolean(event),
        asset: Boolean(asset),
        fallback: Boolean(fallback),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const FALLBACK_TEMPLATE_PREFIX = '__venue_map_asset__';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { eventId } = await req.json();

    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    let event = null;
    let fallbackAsset = null;

    try {
      event = await base44.asServiceRole.entities.Event.get(eventId);
    } catch (eventError) {
      console.warn('Event venue map read failed:', eventError.message);
    }

    try {
      const fallbackName = `${FALLBACK_TEMPLATE_PREFIX}:${eventId}`;
      let fallbacks = await base44.asServiceRole.entities.MapTemplate.filter({ name: fallbackName });
      if (!fallbacks?.length) {
        const allFallbacks = await base44.asServiceRole.entities.MapTemplate.list();
        fallbacks = allFallbacks?.filter((item: Record<string, any>) => item.name === fallbackName) || [];
      }
      fallbackAsset = fallbacks?.[0]?.areas?.[0] || null;
    } catch (fallbackError) {
      console.warn('Venue map fallback read failed:', fallbackError.message);
    }

    const resolved = {
      event_id: eventId,
      map_pdf_url: fallbackAsset?.map_pdf_url || event?.map_pdf_url || null,
      map_image_url: fallbackAsset?.map_image_url || event?.map_image_url || null,
      updated_at: fallbackAsset?.updated_at || null,
    };

    return Response.json({
      event,
      asset: resolved,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

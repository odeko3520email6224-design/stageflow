import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const unique = (items: string[] = []) => [...new Set(items.filter(Boolean))];

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

    const body = await req.json().catch(() => ({}));
    const { action, eventId } = body;
    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    if (action === 'setSplitBySide') {
      const { positionTypeId, positionTypeName, split_by_side } = body;
      if (!positionTypeId || !positionTypeName) {
        return Response.json({ error: 'position type is required' }, { status: 400 });
      }

      const splitBySide = Boolean(split_by_side);
      const [positionType, positions] = await Promise.all([
        base44.asServiceRole.entities.PositionType.update(positionTypeId, { split_by_side: splitBySide }),
        base44.asServiceRole.entities.Position.filter({ event_id: eventId }),
      ]);

      const matchingPositions = positions.filter((position: Record<string, any>) => position.name === positionTypeName);
      const updatedPositions = [];

      for (const position of matchingPositions) {
        const kamite = position.staff_names_kamite || [];
        const shimote = position.staff_names_shimote || [];
        const staffNames = splitBySide
          ? unique([...kamite, ...shimote, ...(position.staff_names || [])])
          : unique(position.staff_names || []);
        const updated = await base44.asServiceRole.entities.Position.update(position.id, {
          split_by_side: splitBySide,
          staff_names: staffNames,
          staff_names_kamite: kamite,
          staff_names_shimote: shimote,
        });
        updatedPositions.push({ ...(updated || position), id: position.id, split_by_side: splitBySide });
      }

      return Response.json({ positionType, positions: updatedPositions });
    }

    if (action === 'updatePositionStaff') {
      const { positionId, staff_names = [], staff_names_kamite = [], staff_names_shimote = [], split_by_side = false } = body;
      if (!positionId) {
        return Response.json({ error: 'positionId is required' }, { status: 400 });
      }
      const splitBySide = Boolean(split_by_side);
      const kamite = unique(staff_names_kamite);
      const shimote = unique(staff_names_shimote);
      const staffNames = splitBySide ? unique([...kamite, ...shimote]) : unique(staff_names);
      const allowedFields = ['name', 'time_slot', 'notes', 'color', 'map_x', 'map_y', 'required_count', 'order'];
      const extraFields = Object.fromEntries(
        allowedFields
          .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
          .map((field) => [field, body[field]])
      );
      const position = await base44.asServiceRole.entities.Position.update(positionId, {
        ...extraFields,
        staff_names: staffNames,
        staff_names_kamite: kamite,
        staff_names_shimote: shimote,
        split_by_side: splitBySide,
      });
      return Response.json({
        position: {
          ...(position || {}),
          id: positionId,
          staff_names: staffNames,
          staff_names_kamite: kamite,
          staff_names_shimote: shimote,
          split_by_side: splitBySide,
        },
      });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

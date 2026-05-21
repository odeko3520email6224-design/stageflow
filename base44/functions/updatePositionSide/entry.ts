import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const unique = (items: string[] = []) => [...new Set(items.filter(Boolean))];
const SIDE_TEMPLATE_PREFIX = '__position_side__';

async function loadSideTemplate(base44: any, eventId: string) {
  const name = `${SIDE_TEMPLATE_PREFIX}:${eventId}`;
  let records = await base44.asServiceRole.entities.MapTemplate.filter({ name });
  if (!records?.length) {
    const allRecords = await base44.asServiceRole.entities.MapTemplate.list();
    records = allRecords?.filter((item: Record<string, any>) => item.name === name) || [];
  }
  const record = records
    ?.sort((a: Record<string, any>, b: Record<string, any>) => {
      const aDate = new Date(a.updated_date || a.created_date || 0).getTime();
      const bDate = new Date(b.updated_date || b.created_date || 0).getTime();
      return bDate - aDate;
    })?.[0] || null;
  const data = record?.areas?.[0] || {};
  return {
    record,
    name,
    data: {
      position_types: data.position_types || {},
      positions: data.positions || {},
      updated_at: data.updated_at || null,
    },
  };
}

async function saveSideTemplate(base44: any, eventId: string, template: Record<string, any>) {
  const { record, ...data } = template;
  const payload = {
    name: `${SIDE_TEMPLATE_PREFIX}:${eventId}`,
    description: 'StageFlow position side settings',
    areas: [{
      ...data,
      updated_at: new Date().toISOString(),
    }],
  };
  return record?.id
    ? await base44.asServiceRole.entities.MapTemplate.update(record.id, payload)
    : await base44.asServiceRole.entities.MapTemplate.create(payload);
}

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
      const [positionType, positions, sideTemplate] = await Promise.all([
        base44.asServiceRole.entities.PositionType.get(positionTypeId),
        base44.asServiceRole.entities.Position.filter({ event_id: eventId }),
        loadSideTemplate(base44, eventId),
      ]);

      const matchingPositions = positions.filter((position: Record<string, any>) => position.name === positionTypeName);
      const updatedPositions = [];
      const nextSideData = {
        ...sideTemplate.data,
        position_types: {
          ...sideTemplate.data.position_types,
          [positionTypeName]: splitBySide,
        },
        positions: {
          ...sideTemplate.data.positions,
        },
      };

      for (const position of matchingPositions) {
        const existingSide = nextSideData.positions[position.id] || {};
        const kamite = splitBySide ? [] : (existingSide.staff_names_kamite || []);
        const shimote = splitBySide ? [] : (existingSide.staff_names_shimote || []);
        const staffNames = splitBySide
          ? []
          : unique(position.staff_names || []);
        const updated = await base44.asServiceRole.entities.Position.update(position.id, { staff_names: staffNames });
        nextSideData.positions[position.id] = {
          ...existingSide,
          split_by_side: splitBySide,
          staff_names_kamite: kamite,
          staff_names_shimote: shimote,
        };
        updatedPositions.push({
          ...(updated || position),
          id: position.id,
          split_by_side: splitBySide,
          staff_names_kamite: kamite,
          staff_names_shimote: shimote,
        });
      }

      await saveSideTemplate(base44, eventId, { record: sideTemplate.record, ...nextSideData });

      return Response.json({
        positionType: { ...(positionType || {}), id: positionTypeId, split_by_side: splitBySide },
        positions: updatedPositions,
        sideSettings: nextSideData,
      });
    }

    if (action === 'updatePositionStaff') {
      const { positionId } = body;
      if (!positionId) {
        return Response.json({ error: 'positionId is required' }, { status: 400 });
      }
      const allowedFields = [
        'name',
        'time_slot',
        'notes',
        'color',
        'map_x',
        'map_y',
        'map_x_kamite',
        'map_y_kamite',
        'map_x_shimote',
        'map_y_shimote',
        'required_count',
        'order',
      ];
      const extraFields = Object.fromEntries(
        allowedFields
          .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
          .map((field) => [field, body[field]])
      );
      const [currentPosition, sideTemplate] = await Promise.all([
        base44.asServiceRole.entities.Position.get(positionId),
        loadSideTemplate(base44, eventId),
      ]);
      const existingSide = sideTemplate.data.positions[positionId] || {};
      const splitBySide = Object.prototype.hasOwnProperty.call(body, 'split_by_side')
        ? Boolean(body.split_by_side)
        : Boolean(existingSide.split_by_side);
      const hasStaffNames = Object.prototype.hasOwnProperty.call(body, 'staff_names');
      const hasKamite = Object.prototype.hasOwnProperty.call(body, 'staff_names_kamite');
      const hasShimote = Object.prototype.hasOwnProperty.call(body, 'staff_names_shimote');
      const kamite = hasKamite ? unique(body.staff_names_kamite) : unique(existingSide.staff_names_kamite || currentPosition?.staff_names_kamite || []);
      const shimote = hasShimote ? unique(body.staff_names_shimote) : unique(existingSide.staff_names_shimote || currentPosition?.staff_names_shimote || []);
      const staffNames = splitBySide
        ? unique([...kamite, ...shimote])
        : hasStaffNames
          ? unique(body.staff_names)
          : unique(currentPosition?.staff_names || []);
      const nextSideData = {
        ...sideTemplate.data,
        positions: {
          ...sideTemplate.data.positions,
          [positionId]: {
            ...existingSide,
            split_by_side: splitBySide,
            staff_names_kamite: kamite,
            staff_names_shimote: shimote,
          },
        },
      };
      const position = await base44.asServiceRole.entities.Position.update(positionId, {
        ...extraFields,
        staff_names: staffNames,
      });
      await saveSideTemplate(base44, eventId, { record: sideTemplate.record, ...nextSideData });
      return Response.json({
        position: {
          ...(position || {}),
          id: positionId,
          staff_names: staffNames,
          staff_names_kamite: kamite,
          staff_names_shimote: shimote,
          split_by_side: splitBySide,
        },
        sideSettings: nextSideData,
      });
    }

    return Response.json({ error: 'unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

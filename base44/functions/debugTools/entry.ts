import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TIME_SLOTS = ['開場中', '開演中', '終演後'];

const getRequiredCountForSlot = (positionType: Record<string, any>, slot: string) => {
  if (slot === TIME_SLOTS[0]) return positionType.required_count_before ?? positionType.required_count ?? 0;
  if (slot === TIME_SLOTS[1]) return positionType.required_count_during ?? positionType.required_count ?? 0;
  return positionType.required_count_after ?? positionType.required_count ?? 0;
};

const sortByOrder = (a: Record<string, any>, b: Record<string, any>) => (a.order ?? 0) - (b.order ?? 0);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, eventId } = body;
    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    if (action === 'setDebugEnabled') {
      const event = await base44.asServiceRole.entities.Event.update(eventId, {
        debug_enabled: Boolean(body.debug_enabled),
      });

      return Response.json({ event });
    }

    if (action !== 'autoPlace') {
      return Response.json({ error: 'unknown action' }, { status: 400 });
    }

    const [event, staffList, positionTypes, existingPositions] = await Promise.all([
      base44.asServiceRole.entities.Event.get(eventId),
      base44.asServiceRole.entities.Staff.filter({ event_id: eventId }),
      base44.asServiceRole.entities.PositionType.list(),
      base44.asServiceRole.entities.Position.filter({ event_id: eventId }),
    ]);

    if (!event?.debug_enabled && !body.debug_enabled) {
      return Response.json({ error: 'デバッグ機能がOFFです' }, { status: 400 });
    }

    const activeStaff = staffList.filter((staff: Record<string, any>) => staff.name);
    const sortedPositionTypes = [...positionTypes].sort(sortByOrder);

    if (sortedPositionTypes.length === 0) {
      return Response.json({ error: 'ポジション設定を登録してください' }, { status: 400 });
    }
    if (activeStaff.length === 0) {
      return Response.json({ error: 'スタッフを登録してください' }, { status: 400 });
    }

    let cursor = 0;
    let created = 0;
    let updated = 0;
    let assigned = 0;

    for (const slot of TIME_SLOTS) {
      const assignedInSlot = new Set<string>();

      for (const [index, positionType] of sortedPositionTypes.entries()) {
        const requiredCount = getRequiredCountForSlot(positionType, slot);
        const assignCount = Math.min(activeStaff.length, Math.max(1, requiredCount));
        const staffNames: string[] = [];

        for (let i = 0; i < assignCount; i += 1) {
          let staff = activeStaff[cursor % activeStaff.length];
          let attempts = 0;

          while (assignedInSlot.has(staff.name) && attempts < activeStaff.length) {
            cursor += 1;
            staff = activeStaff[cursor % activeStaff.length];
            attempts += 1;
          }

          cursor += 1;
          if (staff?.name) {
            staffNames.push(staff.name);
            assignedInSlot.add(staff.name);
          }
        }

        const existing = existingPositions.find((position: Record<string, any>) =>
          (position.time_slot || TIME_SLOTS[0]) === slot && position.name === positionType.name
        );

        const payload = {
          name: positionType.name,
          time_slot: slot,
          staff_names: staffNames,
          color: positionType.color || '#6366f1',
          required_count: requiredCount,
          order: existing?.order ?? index,
        };

        if (existing) {
          await base44.asServiceRole.entities.Position.update(existing.id, payload);
          updated += 1;
        } else {
          await base44.asServiceRole.entities.Position.create({
            event_id: eventId,
            notes: '',
            ...payload,
          });
          created += 1;
        }

        assigned += staffNames.length;
      }
    }

    return Response.json({ created, updated, assigned });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

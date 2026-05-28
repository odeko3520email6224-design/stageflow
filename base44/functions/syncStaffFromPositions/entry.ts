import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Syncs Staff records from Position.staff_names data
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'chief')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { eventId } = await req.json();
    if (!eventId) {
      return Response.json({ error: 'eventId is required' }, { status: 400 });
    }

    // Get all positions for this event
    const positions = await base44.asServiceRole.entities.Position.filter({ event_id: eventId });

    // Collect unique staff names from positions
    const staffNamesSet = new Set();
    for (const pos of positions) {
      for (const name of (pos.staff_names || [])) {
        if (name && name.trim()) {
          staffNamesSet.add(name.trim());
        }
      }
    }

    // Get existing staff records
    const existingStaff = await base44.asServiceRole.entities.Staff.filter({ event_id: eventId });
    const existingNames = new Set(existingStaff.map(s => s.name));

    // Create missing staff records
    const toCreate = [...staffNamesSet].filter(name => !existingNames.has(name));
    const created = [];

    for (const name of toCreate) {
      const staff = await base44.asServiceRole.entities.Staff.create({ event_id: eventId, name });
      created.push(staff);
    }

    return Response.json({
      success: true,
      existing: existingStaff.length,
      created: created.length,
      total: existingStaff.length + created.length,
      createdNames: created.map(s => s.name),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
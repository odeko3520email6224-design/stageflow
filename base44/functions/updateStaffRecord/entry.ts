import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Handles staff CRUD operations (create, update, delete) via service role
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, staffId, data } = await req.json();

    if (action === 'create') {
      if (!data?.event_id || !data?.name) {
        return Response.json({ error: 'event_id and name are required' }, { status: 400 });
      }
      const staff = await base44.asServiceRole.entities.Staff.create(data);
      return Response.json({ staff });
    }

    if (action === 'update') {
      if (!staffId || !data) {
        return Response.json({ error: 'staffId and data are required' }, { status: 400 });
      }
      const staff = await base44.asServiceRole.entities.Staff.update(staffId, data);
      return Response.json({ staff });
    }

    if (action === 'delete') {
      if (!staffId) {
        return Response.json({ error: 'staffId is required' }, { status: 400 });
      }
      await base44.asServiceRole.entities.Staff.delete(staffId);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
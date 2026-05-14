import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generateHTML(event, positions, staff, type) {
  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: 'Noto Sans JP', 'Arial Unicode MS', sans-serif; 
        padding: 15px; 
        background: white;
        color: #333;
        font-size: 12px;
      }
      h1 { font-size: 20px; margin-bottom: 10px; font-weight: bold; }
      .info { font-size: 11px; color: #666; margin-bottom: 15px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 11px; }
      th { background: #e8d4c0; font-weight: bold; }
      tr.section-header { background: #e8d4c0; }
      tr.header-row td { background: #f5f5f5; font-weight: bold; }
      td.position-name { font-weight: bold; width: 80px; }
      td.count { width: 40px; text-align: center; }
      td.staff { background: #ffffcc; }
      td.highlight { background: #ffcccc; }
    </style>
  `;

  let content = `
    <h1>${event.name}</h1>
    <div class="info">
      ${event.date ? `開催日: ${event.date}` : ''}
      ${event.venue ? ` / 会場: ${event.venue}` : ''}
    </div>
  `;

  if (type === 'staff') {
    content += `<table>`;
    content += `<tr class="header-row"><td colspan="100">配置表</td></tr>`;
    
    const timeSlots = ['開場前', '開演中', '終演後'];
    timeSlots.forEach((slot) => {
      const slotPositions = positions.filter((p) => (p.time_slot || '開場前') === slot);
      if (slotPositions.length > 0) {
        content += `<tr class="section-header"><td colspan="100">${slot}</td></tr>`;
        slotPositions.forEach((pos) => {
          const staffCount = (pos.staff_names || []).length;
          const staffNames = (pos.staff_names || []).join(' ');
          content += `<tr>
            <td class="position-name">${pos.name || pos.role}</td>
            <td class="count">${staffCount}</td>
            <td class="staff">${staffNames}</td>
          </tr>`;
        });
      }
    });

    const assignedNames = new Set(positions.flatMap(p => p.staff_names || []));
    const unassigned = staff.filter((s) => !assignedNames.has(s.name));
    if (unassigned.length > 0) {
      content += `<tr class="section-header"><td colspan="100">未配置スタッフ</td></tr>`;
      unassigned.forEach((s) => {
        content += `<tr><td colspan="100">${s.name}${s.note ? ` (${s.note})` : ''}</td></tr>`;
      });
    }
    content += `</table>`;
  } else if (type === 'timeline') {
    content += `<table>`;
    content += `<tr class="header-row"><td>スタッフ</td>`;
    const timeSlots = ['開場前', '開演中', '終演後'];
    timeSlots.forEach((slot) => {
      content += `<td>${slot}</td>`;
    });
    content += `</tr>`;

    staff.forEach((s) => {
      content += `<tr><td class="position-name">${s.name}</td>`;
      timeSlots.forEach((slot) => {
        const slotPositions = positions.filter(
          (p) => (p.time_slot || '開場前') === slot && (p.staff_names || []).includes(s.name)
        );
        const posNames = slotPositions.map((p) => p.name || p.role).join(' ');
        content += `<td class="staff">${posNames}</td>`;
      });
      content += `</tr>`;
    });
    content += `</table>`;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap" rel="stylesheet">
      ${styles}
    </head>
    <body>${content}</body>
    </html>
  `;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { eventId, type } = await req.json();

    if (!eventId) {
      return Response.json({ error: 'eventId required' }, { status: 400 });
    }

    const event = await base44.asServiceRole.entities.Event.get(eventId);
    const positions = await base44.asServiceRole.entities.Position.filter({ event_id: eventId });
    const staff = await base44.asServiceRole.entities.Staff.filter({ event_id: eventId });

    const html = generateHTML(event, positions, staff, type);

    return Response.json({
      html: html
    });
  } catch (error) {
    console.error('PDF Export Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
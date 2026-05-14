import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generateHTML(event, positions, staff, type) {
  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: 'Noto Sans JP', 'Arial Unicode MS', sans-serif; 
        padding: 30px; 
        background: white;
        color: #333;
        line-height: 1.6;
      }
      h1 { font-size: 28px; margin-bottom: 15px; font-weight: bold; }
      h2 { font-size: 16px; margin-top: 25px; margin-bottom: 12px; border-bottom: 3px solid #333; padding-bottom: 8px; font-weight: bold; }
      .info { font-size: 13px; color: #666; margin-bottom: 20px; line-height: 1.8; }
      .item { padding: 10px; border-bottom: 1px solid #ddd; margin-bottom: 5px; }
      .item-name { font-weight: bold; font-size: 14px; }
      .item-detail { font-size: 12px; color: #666; margin-top: 4px; }
      .section { margin-bottom: 15px; }
      .section-title { background: #f0f0f0; padding: 8px 12px; font-weight: bold; font-size: 13px; margin-bottom: 8px; }
      .unassigned { background: #fff3cd; padding: 8px 12px; margin-bottom: 6px; border-left: 4px solid #ffc107; font-size: 13px; }
    </style>
  `;

  let content = `
    <h1>${event.name}</h1>
    <div class="info">
      ${event.date ? `開催日: ${event.date}<br>` : ''}
      ${event.venue ? `会場: ${event.venue}<br>` : ''}
      出力日時: ${new Date().toLocaleString('ja-JP')}
    </div>
  `;

  if (type === 'staff') {
    content += `<h2>スタッフ一覧</h2>`;
    const assignedNames = new Set(positions.flatMap(p => p.staff_names || []));
    
    staff.forEach((s) => {
      const assigned = positions
        .filter((p) => (p.staff_names || []).includes(s.name))
        .map((p) => `${p.time_slot || '開場前'}：${p.name || p.role}`)
        .join(', ');

      content += `
        <div class="item">
          <div class="item-name">${s.name}</div>
          ${s.note ? `<div class="item-detail">備考: ${s.note}</div>` : ''}
          ${assigned ? `<div class="item-detail">配置: ${assigned}</div>` : ''}
        </div>
      `;
    });

    const unassigned = staff.filter((s) => !assignedNames.has(s.name));
    if (unassigned.length > 0) {
      content += `<h2>未配置スタッフ</h2>`;
      unassigned.forEach((s) => {
        content += `<div class="unassigned">${s.name}${s.note ? ` (${s.note})` : ''}</div>`;
      });
    }
  } else if (type === 'timeline') {
    content += `<h2>配置タイムライン</h2>`;
    const timeSlots = ['開場前', '開演中', '終演後'];

    timeSlots.forEach((slot) => {
      const slotPositions = positions.filter((p) => (p.time_slot || '開場前') === slot);
      if (slotPositions.length > 0) {
        content += `<div class="section"><div class="section-title">${slot}</div>`;
        slotPositions.forEach((p) => {
          const staffList = p.staff_names ? p.staff_names.join('、') : '未設定';
          content += `
            <div class="item">
              <div class="item-name">${p.name || p.role}</div>
              <div class="item-detail">スタッフ: ${staffList}</div>
              ${p.notes ? `<div class="item-detail">備考: ${p.notes}</div>` : ''}
            </div>
          `;
        });
        content += `</div>`;
      }
    });
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
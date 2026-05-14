import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function generateHTML(event, positions, staff, type) {
  const styles = `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { 
        font-family: 'Noto Sans JP', 'Arial Unicode MS', sans-serif; 
        padding: 8px 10px; 
        background: white;
        color: #000;
        font-size: 9px;
      }
      .title-block { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
      .event-title { font-size: 14px; font-weight: bold; }
      .event-info { font-size: 8px; color: #555; }
      table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 4px; table-layout: fixed; }
      td, th { border: 1px solid #999; padding: 2px 3px; vertical-align: middle; overflow: hidden; text-overflow: ellipsis; word-break: break-all; }
      
      /* 時間帯セクションヘッダー（サーモン色） */
      tr.slot-header td { 
        background: #f4a07a; 
        font-weight: bold; 
        text-align: left;
        padding: 3px 6px;
        font-size: 10px;
      }
      tr.slot-header td.count-cell {
        text-align: center;
      }
      
      /* カラムヘッダー行（グレー） */
      tr.col-header td { 
        background: #c8c8c8; 
        font-weight: bold; 
        text-align: center;
        font-size: 8px;
      }
      
      /* ポジション名列（薄いベージュ） */
      td.pos-name { 
        background: #f5f0e8; 
        font-weight: bold; 
        text-align: left;
        width: 80px;
      }
      
      /* 人数列 */
      td.count { 
        background: #f5f0e8; 
        text-align: center; 
        width: 24px;
        font-weight: bold;
      }
      
      /* スタッフ名セル（薄い黄色） */
      td.staff-cell { 
        background: #fffde7; 
        text-align: center;
        width: 48px;
      }
      
      /* 空セル */
      td.empty { 
        background: #ffffff; 
        width: 48px;
      }
      
      /* 備考列 */
      td.notes { 
        background: #ffffff; 
        text-align: left;
        width: 90px;
      }
      
      /* 空白区切り行 */
      tr.spacer td { 
        border: none; 
        background: white; 
        height: 6px; 
        padding: 0;
      }

      /* タイムライン用 */
      td.tl-name { background: #f5f0e8; font-weight: bold; text-align: left; min-width: 50px; }
      td.tl-pos { background: #fffde7; text-align: center; min-width: 50px; }
      td.tl-empty { background: #fff; min-width: 50px; }
      tr.tl-header td { background: #c8c8c8; font-weight: bold; text-align: center; }
      tr.tl-slot-header td { background: #f4a07a; font-weight: bold; padding: 3px 6px; }
    </style>
  `;

  // イベント日付フォーマット
  let dateStr = '';
  if (event.date) {
    const d = new Date(event.date);
    dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
  }

  let content = `
    <div class="title-block">
      <div>
        <div class="event-title">${event.name}</div>
        <div class="event-info">${dateStr}${event.venue ? '　' + event.venue : ''}</div>
      </div>
    </div>
  `;

  const timeSlots = ['開場前', '開演中', '終演後'];
  // 最大スタッフ数（列数決定用）、最大10列に制限
  const maxStaff = Math.max(...positions.map(p => (p.staff_names || []).length), 0);
  const staffCols = Math.min(Math.max(maxStaff, 5), 10);

  if (type === 'staff') {
    content += `<table>`;

    timeSlots.forEach((slot) => {
      const slotPositions = positions.filter((p) => (p.time_slot || '開場前') === slot);
      if (slotPositions.length === 0) return;

      const totalStaff = slotPositions.reduce((sum, p) => sum + (p.staff_names || []).length, 0);

      // 時間帯ヘッダー行
      content += `<tr class="slot-header">
        <td>${slot}</td>
        <td class="count-cell">${totalStaff}</td>
        ${Array(staffCols).fill('<td></td>').join('')}
        <td></td>
      </tr>`;

      // カラムヘッダー
      content += `<tr class="col-header">
        <td>ポジション</td>
        <td>人数</td>
        ${Array(staffCols).fill('').map((_, i) => `<td>氏名</td>`).join('')}
        <td>備考欄</td>
      </tr>`;

      // 各ポジション
      // グループ分けのための空行挿入（前のposから役割が変わったら）
      let prevRole = null;
      slotPositions.forEach((pos) => {
        const names = pos.staff_names || [];
        const count = names.length;

        // 役割が変わったら空白行
        if (prevRole !== null && prevRole !== pos.role) {
          content += `<tr class="spacer"><td colspan="${staffCols + 3}"></td></tr>`;
        }
        prevRole = pos.role;

        content += `<tr>
          <td class="pos-name">${pos.name || pos.role}</td>
          <td class="count">${count}</td>`;
        
        for (let i = 0; i < staffCols; i++) {
          if (i < names.length) {
            content += `<td class="staff-cell">${names[i]}</td>`;
          } else {
            content += `<td class="empty"></td>`;
          }
        }
        content += `<td class="notes">${pos.notes || ''}</td></tr>`;
      });
    });

    // 未配置スタッフ
    const assignedNames = new Set(positions.flatMap(p => p.staff_names || []));
    const unassigned = staff.filter((s) => !assignedNames.has(s.name));
    if (unassigned.length > 0) {
      content += `<tr class="slot-header"><td>未配置スタッフ</td><td class="count-cell">${unassigned.length}</td>${Array(staffCols).fill('<td></td>').join('')}<td></td></tr>`;
      content += `<tr class="col-header"><td>氏名</td><td colspan="${staffCols + 2}">備考</td></tr>`;
      unassigned.forEach((s) => {
        content += `<tr>
          <td class="pos-name">${s.name}</td>
          <td colspan="${staffCols + 2}" class="notes">${s.note || ''}</td>
        </tr>`;
      });
    }

    content += `</table>`;

  } else if (type === 'timeline') {
    // スタッフ別タイムライン
    const staffTimeline = {};
    staff.forEach((s) => {
      staffTimeline[s.name] = { '開場前': [], '開演中': [], '終演後': [] };
    });
    positions.forEach((pos) => {
      const slot = pos.time_slot || '開場前';
      (pos.staff_names || []).forEach((name) => {
        if (!staffTimeline[name]) staffTimeline[name] = { '開場前': [], '開演中': [], '終演後': [] };
        staffTimeline[name][slot].push(pos.name || pos.role);
      });
    });

    content += `<table>`;
    content += `<tr class="tl-header">
      <td>スタッフ名</td>
      <td>開場前</td>
      <td>開演中</td>
      <td>終演後</td>
    </tr>`;

    Object.keys(staffTimeline).sort().forEach((name) => {
      const tl = staffTimeline[name];
      const hasAny = timeSlots.some(s => tl[s].length > 0);
      content += `<tr>
        <td class="tl-name">${name}</td>
        ${timeSlots.map(slot => tl[slot].length > 0
          ? `<td class="tl-pos">${tl[slot].join('・')}</td>`
          : `<td class="tl-empty">-</td>`
        ).join('')}
      </tr>`;
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

    return Response.json({ html });
  } catch (error) {
    console.error('PDF Export Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
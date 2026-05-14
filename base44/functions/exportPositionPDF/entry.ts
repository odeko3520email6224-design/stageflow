import { jsPDF } from 'npm:jspdf@4.2.1';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { eventId, type } = await req.json();

    if (!eventId) {
      return Response.json({ error: 'eventId required' }, { status: 400 });
    }

    // Fetch event data using service role
    let event;
    try {
      event = await base44.asServiceRole.entities.Event.get(eventId);
    } catch {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    // Fetch positions and staff using service role
    const positions = await base44.asServiceRole.entities.Position.filter({ event_id: eventId });
    const staff = await base44.asServiceRole.entities.Staff.filter({ event_id: eventId });

    const doc = new jsPDF();
    let yPos = 15;

    // Title
    doc.setFontSize(16);
    doc.text(event.name, 15, yPos);
    yPos += 8;

    // Event info
    doc.setFontSize(10);
    if (event.date) {
      doc.text(`開催日: ${event.date}`, 15, yPos);
      yPos += 6;
    }
    if (event.venue) {
      doc.text(`会場: ${event.venue}`, 15, yPos);
      yPos += 6;
    }

    // Timestamp
    doc.setFontSize(8);
    doc.text(`出力日時: ${new Date().toLocaleString('ja-JP')}`, 15, yPos);
    yPos += 8;

    // Content by type
    if (type === 'staff') {
      doc.setFontSize(12);
      doc.text('スタッフ一覧', 15, yPos);
      yPos += 8;

      // Simple text-based staff list
      doc.setFontSize(9);
      staff.forEach((s) => {
        const assigned = positions
          .filter((p) => (p.staff_names || []).includes(s.name))
          .map((p) => `${p.time_slot || '開場前'}：${p.name || p.role}`)
          .join(', ');

        const text = `${s.name}`;
        doc.text(text, 15, yPos);
        yPos += 4;

        if (s.note) {
          doc.setFontSize(8);
          doc.text(`  備考: ${s.note}`, 15, yPos);
          yPos += 3;
        }

        if (assigned) {
          doc.setFontSize(8);
          doc.text(`  配置: ${assigned}`, 15, yPos);
          yPos += 3;
        }

        doc.setFontSize(9);
        yPos += 2;

        // New page if needed
        if (yPos > 270) {
          doc.addPage();
          yPos = 15;
        }
      });
    } else if (type === 'timeline') {
      doc.setFontSize(12);
      doc.text('配置タイムライン', 15, yPos);
      yPos += 8;

      const timeSlots = ['開場前', '開演中', '終演後'];

      timeSlots.forEach((slot) => {
        const slotPositions = positions.filter((p) => (p.time_slot || '開場前') === slot);

        if (slotPositions.length > 0) {
          doc.setFontSize(10);
          doc.text(slot, 15, yPos);
          yPos += 5;

          doc.setFontSize(8);
          slotPositions.forEach((p) => {
            const staffList = p.staff_names ? p.staff_names.join('、') : '未設定';
            const text = `${p.name || p.role} - ${staffList}`;
            doc.text(text, 20, yPos);
            yPos += 4;

            if (p.notes) {
              doc.text(`  (${p.notes})`, 20, yPos);
              yPos += 3;
            }

            if (yPos > 270) {
              doc.addPage();
              yPos = 15;
            }
          });

          yPos += 3;
        }
      });
    }

    const pdfBase64 = doc.output('dataurlstring');

    return Response.json({
      pdf: pdfBase64
    });
  } catch (error) {
    console.error('PDF Export Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
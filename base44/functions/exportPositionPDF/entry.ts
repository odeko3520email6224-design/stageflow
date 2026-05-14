import { jsPDF } from 'npm:jspdf@4.2.1';
import 'npm:jspdf-autotable';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { eventId, type } = await req.json();

    if (!eventId) {
      return Response.json({ error: 'eventId required' }, { status: 400 });
    }

    // Fetch event data using service role
    const events = await base44.asServiceRole.entities.Event.filter({ id: eventId });
    const event = events[0];

    if (!event) {
      return Response.json({ error: 'Event not found' }, { status: 404 });
    }

    // Fetch positions and staff using service role
    const positions = await base44.asServiceRole.entities.Position.filter({ event_id: eventId });
    const staff = await base44.asServiceRole.entities.Staff.filter({ event_id: eventId });

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
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

      // Staff table
      doc.setFontSize(9);
      const tableData = staff.map((s) => {
        const assigned = positions
          .filter((p) => (p.staff_names || []).includes(s.name))
          .map((p) => `${p.time_slot || '開場前'}：${p.name || p.role}`)
          .join(', ');

        return [s.name, s.note || '-', assigned || '未配置'];
      });

      doc.autoTable({
        startY: yPos,
        head: [['スタッフ名', '備考', '配置']],
        body: tableData,
        margin: 15,
        headerStyles: { fillColor: [66, 165, 245], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 40 }, 2: { cellWidth: 80 } },
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

          const tableData = slotPositions.map((p) => [
            p.name || p.role,
            p.staff_names ? p.staff_names.join('、') : '未設定',
            p.notes || '-',
          ]);

          doc.autoTable({
            startY: yPos,
            head: [['ポジション', '担当スタッフ', '備考']],
            body: tableData,
            margin: 15,
            headerStyles: { fillColor: [66, 165, 245], textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 60 }, 2: { cellWidth: 40 } },
            didDrawPage: (data) => {
              yPos = data.lastAutoTable.finalY + 5;
            },
          });

          yPos += 8;
        }
      });
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${event.name}_${type}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
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

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let yPos = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const maxWidth = doc.internal.pageSize.width - 2 * margin;

    // Set font with Japanese support - using built-in font
    doc.setFont('helvetica');
    
    // Title (use basic ASCII for title or minimal Japanese)
    doc.setFontSize(18);
    doc.text(event.name.substring(0, 30), margin, yPos);
    yPos += 10;

    // Event info
    doc.setFontSize(10);
    if (event.date) {
      doc.text(`Date: ${event.date}`, margin, yPos);
      yPos += 6;
    }
    if (event.venue) {
      doc.text(`Venue: ${event.venue}`, margin, yPos);
      yPos += 6;
    }

    // Timestamp
    doc.setFontSize(8);
    doc.text(`Output: ${new Date().toLocaleString('ja-JP')}`, margin, yPos);
    yPos += 8;

    // Content by type
    if (type === 'staff') {
      doc.setFontSize(12);
      doc.text('Staff List', margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      staff.forEach((s) => {
        const assigned = positions
          .filter((p) => (p.staff_names || []).includes(s.name))
          .map((p) => `${p.time_slot || 'Pre'}:${p.name || p.role}`)
          .join(', ');

        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }

        doc.text(`${s.name}`, margin, yPos);
        yPos += 4;

        if (s.note) {
          doc.setFontSize(8);
          doc.text(`Note: ${s.note}`, margin + 3, yPos);
          yPos += 3;
        }

        if (assigned) {
          doc.setFontSize(8);
          doc.text(`Position: ${assigned}`, margin + 3, yPos);
          yPos += 3;
        }

        doc.setFontSize(9);
        yPos += 2;
      });

      const assignedNames = new Set(positions.flatMap((p) => p.staff_names || []));
      const unassigned = staff.filter((s) => !assignedNames.has(s.name));

      if (unassigned.length > 0) {
        if (yPos > pageHeight - 30) {
          doc.addPage();
          yPos = 20;
        }

        yPos += 4;
        doc.setFontSize(10);
        doc.text('Unassigned Staff', margin, yPos);
        yPos += 6;

        doc.setFontSize(9);
        unassigned.forEach((s) => {
          if (yPos > pageHeight - 15) {
            doc.addPage();
            yPos = 20;
          }
          doc.text(`- ${s.name}${s.note ? ` (${s.note})` : ''}`, margin + 3, yPos);
          yPos += 4;
        });
      }
    } else if (type === 'timeline') {
      doc.setFontSize(12);
      doc.text('Position Timeline', margin, yPos);
      yPos += 8;

      const timeSlots = ['Pre', 'During', 'Post'];
      const timeSlotMap = { 'Pre': '開場前', 'During': '開演中', 'Post': '終演後' };

      timeSlots.forEach((slotKey) => {
        const slot = timeSlotMap[slotKey];
        const slotPositions = positions.filter((p) => (p.time_slot || '開場前') === slot);

        if (slotPositions.length > 0) {
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(10);
          doc.text(slotKey, margin, yPos);
          yPos += 5;

          doc.setFontSize(8);
          slotPositions.forEach((p) => {
            if (yPos > pageHeight - 15) {
              doc.addPage();
              yPos = 20;
            }

            const staffList = p.staff_names ? p.staff_names.join(', ') : 'Unset';
            doc.text(`${p.name || p.role} - ${staffList}`, margin + 3, yPos);
            yPos += 4;

            if (p.notes) {
              doc.text(`(${p.notes})`, margin + 5, yPos);
              yPos += 3;
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
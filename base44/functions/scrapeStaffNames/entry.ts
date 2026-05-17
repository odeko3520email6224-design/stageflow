import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, eventId, selectedNames } = await req.json();
    if (!url || !eventId) {
      return Response.json({ error: 'urlとeventIdは必須です' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return Response.json({ error: `ページの取得に失敗しました: ${response.status}` }, { status: 400 });
    }

    const html = await response.text();

    // If selectedNames provided, this is the "confirm & save" phase
    if (selectedNames) {
      const existingStaff = await base44.asServiceRole.entities.Staff.filter({ event_id: eventId });
      const existingNames = new Set(existingStaff.map((s) => s.name));
      const newNames = selectedNames.filter((name) => !existingNames.has(name));
      for (const name of newNames) {
        await base44.asServiceRole.entities.Staff.create({ event_id: eventId, name });
      }
      return Response.json({
        found: selectedNames.length,
        added: newNames.length,
        skipped: selectedNames.length - newNames.length,
        names: newNames,
      });
    }

    // Parse phase: extract staff list with type and memo info
    const staffList = [];

    // Match each TDBox row
    const rowRegex = /<tr[^>]*class="TDBox"[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(html)) !== null) {
      const rowHtml = rowMatch[1];

      // Extract name
      const nameMatch = /<span[^>]*class="[^"]*onamae[^"]*"[^>]*>\s*<span[^>]*class="[^"]*search[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
      if (!name || name === '(氏名なし)') continue;

      // Extract type
      const typeMatch = /<span[^>]*class="[^"]*type[^"]*"[^>]*>\s*<span[^>]*class="[^"]*search[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(rowHtml);
      const type = typeMatch ? typeMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : '';

      // Extract memo value
      const memoMatch = /class="memo_i"[^>]*value="([^"]*)"/i.exec(rowHtml);
      const memo = memoMatch ? memoMatch[1].trim() : '';

      // Default unchecked if type includes "物販" or memo is "帰宅"
      const defaultChecked = !type.includes('物販') && memo !== '帰宅';

      staffList.push({ name, type, memo, defaultChecked });
    }

    if (staffList.length === 0) {
      return Response.json({ staffList: [], message: '名前が見つかりませんでした。URLやページ構造を確認してください。' });
    }

    return Response.json({ staffList });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, eventId } = await req.json();
    if (!url || !eventId) {
      return Response.json({ error: 'urlとeventIdは必須です' }, { status: 400 });
    }

    // Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      return Response.json({ error: `ページの取得に失敗しました: ${response.status}` }, { status: 400 });
    }

    const html = await response.text();

    // Extract names from <span class="onamae"><span class="search">NAME</span></span>
    const names = [];
    // Directly match the nested pattern: onamae > search
    const regex = /<span[^>]*class="[^"]*onamae[^"]*"[^>]*>\s*<span[^>]*class="[^"]*search[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const rawName = match[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
      if (rawName) names.push(rawName);
    }

    if (names.length === 0) {
      return Response.json({ added: 0, message: '名前が見つかりませんでした。URLやページ構造を確認してください。' });
    }

    // Get existing staff for this event to avoid duplicates
    const existingStaff = await base44.asServiceRole.entities.Staff.filter({ event_id: eventId });
    const existingNames = new Set(existingStaff.map((s) => s.name));

    // Add new staff (skip duplicates)
    const newNames = names.filter((name) => !existingNames.has(name));
    for (const name of newNames) {
      await base44.asServiceRole.entities.Staff.create({ event_id: eventId, name });
    }

    return Response.json({
      found: names.length,
      added: newNames.length,
      skipped: names.length - newNames.length,
      names: newNames,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
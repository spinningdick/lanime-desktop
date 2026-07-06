// 封面代理 — 解决防盗链和非标准端口问题
// 匹配 /cover/* 路径

interface PagesContext {
  request: Request;
  env: any;
  params: Record<string, string>;
}

export async function onRequest(context: PagesContext) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // /cover/ 之后的部分就是目标 URL（URL 编码的）
  const coverPath = path.replace('/cover/', '');
  if (!coverPath) {
    return new Response(JSON.stringify({ error: 'missing url' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const coverUrl = decodeURIComponent(coverPath);

  try {
    const resp = await fetch(coverUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.agedm.io/',
        'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
      },
    });

    if (!resp.ok) {
      return new Response('', { status: 404 });
    }

    const ct = resp.headers.get('Content-Type') || 'image/jpeg';
    const etag = resp.headers.get('ETag') || resp.headers.get('Last-Modified') || '';
    const headers: Record<string, string> = {
      'Content-Type': ct,
      'Cache-Control': 'public, max-age=604800, immutable',
      'Access-Control-Allow-Origin': '*',
    };
    if (etag) headers['ETag'] = etag;

    return new Response(resp.body, { headers });
  } catch {
    return new Response('', { status: 502 });
  }
}

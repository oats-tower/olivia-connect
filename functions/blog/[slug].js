/**
 * Cloudflare Pages Function: GET /blog/:slug
 * Fetches the blog post from Supabase and injects SEO meta tags server-side
 * before serving the blog-post.html shell. This ensures crawlers (Google, Twitter,
 * LinkedIn, Facebook) see proper <title>, <meta description>, and Open Graph tags.
 *
 * Set SUPABASE_URL and SUPABASE_ANON_KEY in Cloudflare Pages → Settings → Environment Variables.
 */

export async function onRequestGet(context) {
  const { params, env } = context;
  const slug = params.slug;

  // Fetch the blog post from Supabase REST API
  let post = null;
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=title,body,hero_image_url,tags,created_at&limit=1`,
      {
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Accept': 'application/json',
        },
      }
    );
    const data = await res.json();
    post = Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    // Fall through — serve shell without meta injection
  }

  // Fetch the blog-post.html shell
  const shellUrl = new URL('/blog-post.html', context.request.url);
  const shellRes = await fetch(shellUrl.toString());
  let html = await shellRes.text();

  if (post) {
    const title   = esc(post.title);
    const excerpt = post.body ? post.body.replace(/<[^>]+>/g, '').slice(0, 160) : '';
    const desc    = esc(excerpt);
    const image   = post.hero_image_url ? esc(post.hero_image_url) : '';

    // Replace placeholder meta tags with real values
    html = html
      .replace(/<title id="pageTitle">.*?<\/title>/, `<title id="pageTitle">${title} — Olivia Connect Blog</title>`)
      .replace(/(<meta name="description" id="metaDesc" content=)""/,  `$1"${desc}"`)
      .replace(/(<meta property="og:title" id="ogTitle" content=)""/,  `$1"${title}"`)
      .replace(/(<meta property="og:description" id="ogDesc" content=)""/,  `$1"${desc}"`)
      .replace(/(<meta property="og:image" id="ogImage" content=)""/,  `$1"${image}"`);
  }

  // Inject Supabase env vars so the client JS can use them without a build step
  html = html
    .replace('__SUPABASE_URL__', env.SUPABASE_URL || '')
    .replace('__SUPABASE_ANON_KEY__', env.SUPABASE_ANON_KEY || '');

  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}

function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

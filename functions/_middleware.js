/**
 * Cloudflare Pages _middleware.js
 * Runs on every request. For HTML responses, replaces __SUPABASE_URL__ and
 * __SUPABASE_ANON_KEY__ placeholders so the Supabase JS client works in
 * static pages (blog.html, admin/*.html, index.html).
 *
 * blog-post.html is already handled by functions/blog/[slug].js — this
 * middleware is a fallback for all other HTML pages.
 */
export async function onRequest(context) {
  const { request, next, env } = context;
  const res = await next();

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return res;

  let html = await res.text();

  html = html
    .replace(/__SUPABASE_URL__/g,      env.SUPABASE_URL      || '')
    .replace(/__SUPABASE_ANON_KEY__/g, env.SUPABASE_ANON_KEY || '');

  return new Response(html, {
    status:  res.status,
    headers: res.headers,
  });
}

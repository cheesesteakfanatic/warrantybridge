// Server-renders invite links so message apps (iMessage, WhatsApp, Slack…)
// show WHO the invite is for and WHICH home, then forwards humans into the app.
exports.handler = async (event) => {
  const path = event.path || '';
  const m = path.match(/^\/join\/([^/]+)\/([^/]+)\/([a-zA-Z0-9]+)\/?$/);
  const role = m ? m[1].toLowerCase() : '';
  const home = m ? m[2].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
  const code = m ? m[3].toLowerCase() : '';
  const roleLabel = { buyer: 'Homebuyer', builder: 'Builder', viewer: 'View-Only Guest' }[role] || 'Member';
  const roleDesc = {
    buyer: 'Sign up as the homebuyer - report issues with photos, message the builder, and track every repair.',
    builder: 'Sign up as the builder - manage warranty issues, schedule repairs, and keep a documented record.',
    viewer: 'View-only access - follow every issue, photo, and message without making changes.',
  }[role] || 'Join this home on WarrantyBridge.';
  const title = home ? `Join ${home} as ${roleLabel}` : 'Join a home on WarrantyBridge';
  const desc = roleDesc + ' Tap to create your account.';
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const url = 'https://thewarrantybridge.com' + path;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)} - WarrantyBridge</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="WarrantyBridge">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="https://thewarrantybridge.com/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="https://thewarrantybridge.com/og-image.png">
<link rel="icon" href="/favicon.svg">
<script>location.replace('/?join=' + encodeURIComponent(${JSON.stringify(code)}));</script>
</head><body style="font-family:-apple-system,sans-serif;padding:48px;text-align:center;color:#18181b">
<p>Taking you to WarrantyBridge…</p>
<p><a href="/?join=${esc(code)}" style="color:#4f46e5">Continue to sign up</a></p>
</body></html>`;
  return { statusCode: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' }, body: html };
};

const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
const upload = multer({ dest: 'uploads/' }); // Temporary storage for uploaded files

// Serve static frontend files (index.html, styles.css, script.js, etc.)
app.use(express.static(__dirname));

// SPA-style routes that mirror _redirects for Cloudflare Pages
app.get('/blog', (req, res) => res.sendFile(path.join(__dirname, 'blog.html')));
app.get('/admin',  (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.get('/admin/', (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));

// /blog/:slug — serve blog-post.html with server-injected SEO meta tags
// (mirrors what functions/blog/[slug].js does on Cloudflare Pages)
app.get('/blog/:slug', async (req, res) => {
  const slug = req.params.slug;
  let post = null;

  try {
    const apiUrl = `${process.env.SUPABASE_URL}/rest/v1/blog_posts`;
    console.log(`[blog] fetching post slug="${slug}" from ${apiUrl}`);
    const response = await axios.get(apiUrl, {
      params: {
        slug:   `eq.${slug}`,
        status: 'eq.published',
        select: 'title,body,hero_image_url,tags,created_at',
        limit:  1,
      },
      headers: {
        'apikey':        process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    });
    post = Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : null;
    console.log(`[blog] post found: ${post ? post.title : 'null'}`);
  } catch (err) {
    console.error('[blog] Supabase fetch failed:', err.response?.status, err.response?.data || err.message);
  }

  let html = fs.readFileSync(path.join(__dirname, 'blog-post.html'), 'utf8');

  if (post) {
    const title   = esc(post.title);
    const excerpt = post.body ? post.body.replace(/<[^>]+>/g, '').slice(0, 160) : '';
    const desc    = esc(excerpt);
    const image   = post.hero_image_url ? esc(post.hero_image_url) : '';

    html = html
      .replace(/<title id="pageTitle">.*?<\/title>/, `<title id="pageTitle">${title} — Olivia Connect Blog</title>`)
      .replace(/(<meta name="description" id="metaDesc" content=)""/,  `$1"${desc}"`)
      .replace(/(<meta property="og:title" id="ogTitle" content=)""/,  `$1"${title}"`)
      .replace(/(<meta property="og:description" id="ogDesc" content=)""/,  `$1"${desc}"`)
      .replace(/(<meta property="og:image" id="ogImage" content=)""/,  `$1"${image}"`);

    console.log('[blog] meta tags injected successfully');
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Function to get a fresh token for every request
async function getFreshToken() {
  try {
    const response = await axios.post('https://olivia-connect.com/api/login', {
      api_user: {
        email: process.env.API_USERNAME,
        password: process.env.API_PASSWORD,
      },
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error fetching fresh token:', error.response?.data || error.message);
    throw new Error('Failed to fetch fresh token');
  }
}

// Proxy endpoint for parsing invoices
app.post('/api/parse-invoice', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;

    // Step 1: login to get a fresh token
    console.log('[1/2] Calling login endpoint...');
    const freshToken = await getFreshToken();
    console.log('[1/2] Login successful, token acquired.');

    // Step 2: call parse_inv with the fresh token
    console.log('[2/2] Calling parse_inv endpoint...');
    // Prepare the multipart form-data payload
    const formData = new FormData();
    formData.append('file', fs.createReadStream(file.path), {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    // Send the request to the Olivia Connect API
    const response = await axios.post('https://olivia-connect.com/api/v1/parse_inv.json', formData, {
      headers: {
        'Authorization': `Bearer ${freshToken}`,
        'Accept': 'application/json',
        ...formData.getHeaders(),
      },
    });

    // Send the parsed data back to the client
    res.json(response.data);
  } catch (error) {
    console.error('Error parsing invoice:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to parse invoice' });
  } finally {
    // Clean up the uploaded file
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete uploaded file:', err);
      });
    }
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
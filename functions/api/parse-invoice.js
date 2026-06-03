/**
 * Cloudflare Pages Function: POST /api/parse-invoice
 * Replaces backend-proxy.js for production (Cloudflare deployment).
 * Set API_USERNAME and API_PASSWORD in Cloudflare Pages → Settings → Environment Variables.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // ── 1. Parse the incoming multipart form from the browser ──
  let incomingForm;
  try {
    incomingForm = await request.formData();
  } catch {
    return jsonResponse({ error: 'Invalid form data.' }, 400);
  }

  const file = incomingForm.get('file');
  if (!file || typeof file === 'string') {
    return jsonResponse({ error: 'No file uploaded.' }, 400);
  }

  // ── 2. Login to Olivia Connect to get a fresh token ──
  console.log('[1/2] Calling login endpoint...');
  let accessToken;
  try {
    const loginRes = await fetch('https://olivia-connect.com/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        api_user: {
          email: env.API_USERNAME,
          password: env.API_PASSWORD,
        },
      }),
    });

    const loginData = await loginRes.json();
    accessToken = loginData.access_token;

    if (!accessToken) {
      console.error('Login returned no access_token:', loginData);
      return jsonResponse({ error: 'Authentication failed.' }, 502);
    }
    console.log('[1/2] Login successful, token acquired.');
  } catch (err) {
    console.error('Login request failed:', err.message);
    return jsonResponse({ error: 'Failed to reach authentication endpoint.' }, 502);
  }

  // ── 3. Forward the file to the Olivia Connect parser ──
  console.log('[2/2] Calling parse_inv endpoint...');
  try {
    const outgoingForm = new FormData();
    outgoingForm.append('file', file, file.name);

    const parseRes = await fetch('https://olivia-connect.com/api/v1/parse_inv.json', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
      body: outgoingForm,
    });

    if (!parseRes.ok) {
      const errData = await parseRes.json().catch(() => ({}));
      console.error('parse_inv error:', errData);
      return jsonResponse({ error: 'Parser returned an error.', detail: errData }, parseRes.status);
    }

    const parseData = await parseRes.json();

    // If the API returned a full result (has merchant or invoice_number), return it directly.
    if (parseData.merchant !== undefined || parseData.invoice_number !== undefined) {
      return jsonResponse(parseData, 200);
    }

    // Otherwise the API queued the job and returned only a reference — poll for the result.
    const reference = parseData.reference;
    if (!reference) {
      console.error('Unexpected parse_inv response:', parseData);
      return jsonResponse({ error: 'Unexpected response from parser.' }, 502);
    }

    console.log(`[poll] Job queued, reference=${reference}. Polling for result...`);
    const pollUrl = `https://olivia-connect.com/api/v1/parse_inv/${reference}.json`;
    const MAX_ATTEMPTS = 15;
    const DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      console.log(`[poll] Attempt ${attempt}/${MAX_ATTEMPTS}...`);

      const pollRes = await fetch(pollUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!pollRes.ok) {
        console.warn(`[poll] Non-200 status: ${pollRes.status}`);
        continue;
      }

      const pollData = await pollRes.json();

      // Result is ready when it has actual invoice fields.
      if (pollData.merchant !== undefined || pollData.invoice_number !== undefined) {
        console.log(`[poll] Result ready on attempt ${attempt}.`);
        return jsonResponse(pollData, 200);
      }

      console.log(`[poll] Not ready yet, response:`, JSON.stringify(pollData));
    }

    return jsonResponse({ error: 'Parser timed out. Please try again.' }, 504);
  } catch (err) {
    console.error('Parse request failed:', err.message);
    return jsonResponse({ error: 'Failed to reach parsing endpoint.' }, 502);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

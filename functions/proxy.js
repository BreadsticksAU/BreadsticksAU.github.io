// Netlify serverless function proxy for Apps Script
// It forwards GET/POST to your Apps Script and returns responses with CORS headers.
// Set environment variable APPS_SECRET in Netlify (your Apps Script SECRET_TOKEN).
const APPSCRIPT_URL = 'https://script.google.com/a/macros/umail.usq.edu.au/s/AKfycbwVLqYPnT-R28m-s1-Q2qLbvkbIg6NK6QShGoSfzxt3ut8sY8RlCa0cUPJk1apSHux72Q/exec';
const SECRET = process.env.APPS_SECRET || '';

exports.handler = async function(event) {
  // Respond to CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        // Restrict to your site if you want: 'https://breadsticksau.github.io'
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: ''
    };
  }

  const headers = { 'Content-Type': 'application/json' };

  try {
    if (event.httpMethod === 'GET') {
      // Forward GET; preserve query params but inject token if absent
      const url = new URL(APPSCRIPT_URL);
      const params = event.queryStringParameters || {};
      Object.keys(params).forEach(k => { if (params[k] !== undefined && params[k] !== null) url.searchParams.set(k, params[k]); });
      if (!url.searchParams.get('token') && SECRET) url.searchParams.set('token', SECRET);
      const resp = await fetch(url.toString(), { method: 'GET', headers });
      const text = await resp.text();
      return {
        statusCode: resp.status,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': resp.headers.get('content-type') || 'application/json' },
        body: text
      };
    }

    if (event.httpMethod === 'POST') {
      const incoming = event.body ? JSON.parse(event.body) : {};
      if (!incoming.token && SECRET) incoming.token = SECRET;
      const resp = await fetch(APPSCRIPT_URL, { method: 'POST', headers, body: JSON.stringify(incoming) });
      const text = await resp.text();
      return {
        statusCode: resp.status,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': resp.headers.get('content-type') || 'application/json' },
        body: text
      };
    }

    return { statusCode: 405, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'Method Not Allowed' };
  } catch (err) {
    return { statusCode: 500, headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ success:false, error:String(err) }) };
  }
};

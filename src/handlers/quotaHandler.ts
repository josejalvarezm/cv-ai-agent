/**
 * AI quota management endpoint handlers
 */

import { getQuotaStatus, resetQuota, syncQuotaFromDashboard } from '../ai-quota';
import { CORS_CONFIG } from '../config';

interface Env {
  KV: KVNamespace;
  JWT_SECRET?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_CONFIG.ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': CORS_CONFIG.ALLOWED_METHODS,
  'Access-Control-Allow-Headers': CORS_CONFIG.ALLOWED_HEADERS,
};

/**
 * GET /quota - Get current AI quota status
 */
export async function handleQuotaStatus(env: Env): Promise<Response> {
  const quotaStatus = await getQuotaStatus(env.KV);
  return new Response(JSON.stringify(quotaStatus), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * GET /admin/quota - Admin endpoint with authentication
 */
export async function handleAdminQuota(request: Request, env: Env): Promise<Response> {
  // Simple auth: if JWT_SECRET is set require a Bearer token matching it (admin use only)
  const authHeader = request.headers.get('Authorization');
  if (env.JWT_SECRET) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
    const token = authHeader.substring(7);
    if (token !== env.JWT_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  const quota = await getQuotaStatus(env.KV);
  return new Response(JSON.stringify({ success: true, quota }), { 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  });
}

/**
 * POST /quota/reset - Reset quota manually
 */
export async function handleQuotaReset(env: Env): Promise<Response> {
  // TODO: Add proper authentication/authorization
  await resetQuota(env.KV);
  const newStatus = await getQuotaStatus(env.KV);
  return new Response(JSON.stringify({
    success: true,
    message: 'Quota reset successfully',
    status: newStatus,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * POST /quota/sync - Sync quota from dashboard
 * Usage: POST /quota/sync with body: { "neurons": 137.42 }
 */
export async function handleQuotaSync(request: Request, env: Env): Promise<Response> {
  // TODO: Add proper authentication/authorization
  try {
    const body = await request.json() as any;
    const neurons = parseFloat(body.neurons);
    
    if (isNaN(neurons) || neurons < 0) {
      return new Response(JSON.stringify({
        error: 'Invalid neurons value. Must be a positive number.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    await syncQuotaFromDashboard(env.KV, neurons);
    const newStatus = await getQuotaStatus(env.KV);
    
    return new Response(JSON.stringify({
      success: true,
      message: `Quota synced successfully. Updated to ${neurons} neurons.`,
      status: newStatus,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({
      error: 'Failed to parse request body. Expected: { "neurons": <number> }',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

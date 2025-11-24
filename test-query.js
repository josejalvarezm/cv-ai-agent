const WORKER_URL = 'https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}';

async function test() {
  // Test query
  const response = await fetch(${WORKER_URL}/query?q=what+is+C%23+experience);
  const data = await response.json();
  console.log('Query result:', JSON.stringify(data, null, 2));
  
  // Test health
  const healthResp = await fetch(${WORKER_URL}/health);
  const health = await healthResp.json();
  console.log('\nHealth:', JSON.stringify(health, null, 2));
}

test().catch(console.error);

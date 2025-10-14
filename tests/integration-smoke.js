/**
 * Integration Smoke Tests for CV Assistant Worker
 * 
 * Runs fast smoke tests against deployed Worker:
 * - GET /ids - returns array of technology IDs
 * - POST /index/resume (batchSize=1) - processes one item
 * - GET /index/progress - returns checkpoint with updated offset
 * - GET /query?q=TypeScript - returns semantic results
 * 
 * Usage:
 *   node tests/integration-smoke.js <worker-url>
 * 
 * Example:
 *   node tests/integration-smoke.js https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}
 */

const workerUrl = process.argv[2] || 'https://cv-assistant-worker-production.{YOUR_WORKERS_SUBDOMAIN}';

async function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

async function testGetIds() {
  console.log('\n🧪 Test: GET /ids');
  const res = await fetch(`${workerUrl}/ids`);
  const data = await res.json();
  
  await assert(res.status === 200, 'Status is 200');
  await assert(Array.isArray(data.ids), 'Response has ids array');
  await assert(data.ids.length > 0, `IDs array is not empty (got ${data.ids.length})`);
  
  console.log(`   Found ${data.ids.length} technology IDs`);
  return data.ids;
}

async function testIndexResume() {
  console.log('\n🧪 Test: POST /index/resume');
  
  const res = await fetch(`${workerUrl}/index/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'technology', batchSize: 1 }),
  });
  
  const data = await res.json();
  
  await assert(res.status === 200 || res.status === 409, `Status is 200 or 409 (got ${res.status})`);
  
  if (res.status === 409) {
    console.log('   ℹ️  Indexing already in progress (lock held)');
    return { locked: true };
  }
  
  await assert(data.triggered === true, 'Resume triggered successfully');
  console.log('   Triggered indexing batch');
  return data;
}

async function testIndexProgress() {
  console.log('\n🧪 Test: GET /index/progress');
  
  const res = await fetch(`${workerUrl}/index/progress`);
  const data = await res.json();
  
  await assert(res.status === 200, 'Status is 200');
  
  if (data.found === false) {
    console.log('   ℹ️  No checkpoint found yet');
    return null;
  }
  
  await assert(typeof data.version === 'number', 'Checkpoint has version');
  await assert(typeof data.nextOffset === 'number', 'Checkpoint has nextOffset');
  await assert(typeof data.processed === 'number', 'Checkpoint has processed count');
  await assert(typeof data.total === 'number', 'Checkpoint has total count');
  await assert(typeof data.status === 'string', 'Checkpoint has status');
  
  console.log(`   Checkpoint: ${data.processed}/${data.total} processed, nextOffset=${data.nextOffset}, status=${data.status}`);
  return data;
}

async function testQuery() {
  console.log('\n🧪 Test: GET /query?q=TypeScript');
  
  const res = await fetch(`${workerUrl}/query?q=TypeScript`);
  const data = await res.json();
  
  await assert(res.status === 200, 'Status is 200');
  await assert(data.query === 'TypeScript', 'Query echoed in response');
  await assert(Array.isArray(data.results), 'Results is an array');
  await assert(data.results.length > 0, `Results array is not empty (got ${data.results.length})`);
  
  const firstResult = data.results[0];
  await assert(typeof firstResult.id === 'number', 'First result has id');
  await assert(typeof firstResult.name === 'string', 'First result has name');
  await assert(typeof firstResult.distance === 'number', 'First result has distance');
  await assert(firstResult.distance >= 0 && firstResult.distance <= 1, 'Distance is in range [0,1]');
  
  console.log(`   Found ${data.results.length} results, top match: "${firstResult.name}" (distance=${firstResult.distance.toFixed(3)})`);
  return data;
}

async function testHealth() {
  console.log('\n🧪 Test: GET /health');
  
  const res = await fetch(`${workerUrl}/health`);
  const data = await res.json();
  
  await assert(res.status === 200, 'Status is 200');
  await assert(data.status === 'healthy', 'Status is healthy');
  await assert(typeof data.total_skills === 'number', 'Has total_skills count');
  
  console.log(`   Status: ${data.status}, Total skills: ${data.total_skills}`);
  return data;
}

async function main() {
  console.log('🚀 Starting integration smoke tests');
  console.log(`   Target: ${workerUrl}`);
  
  try {
    await testHealth();
    await testGetIds();
    
    const progressBefore = await testIndexProgress();
    const resumeResult = await testIndexResume();
    
    // wait a moment for indexing to complete
    if (resumeResult && !resumeResult.locked) {
      console.log('\n   ⏳ Waiting 2s for batch to complete...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    const progressAfter = await testIndexProgress();
    
    // verify progress advanced (if not locked)
    if (progressBefore && progressAfter && !resumeResult.locked) {
      await assert(
        progressAfter.nextOffset > progressBefore.nextOffset || progressAfter.status === 'completed',
        `Progress advanced (before: ${progressBefore.nextOffset}, after: ${progressAfter.nextOffset})`
      );
    }
    
    await testQuery();
    
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error(`\n❌ Test suite failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

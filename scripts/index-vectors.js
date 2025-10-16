#!/usr/bin/env node
/**
 * Vector Indexing Automation Script
 * 
 * Automatically indexes all technology records by generating embeddings
 * and storing them in the D1 vectors table for semantic search.
 */

const WORKER_URL = process.env.WORKER_URL || 'https://cv-assistant-worker.{YOUR_WORKERS_SUBDOMAIN}';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '10', 10);
const TOTAL_RECORDS = parseInt(process.env.TOTAL_RECORDS || '64', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '200', 10);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, colors.cyan);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`   ${message}`, colors.gray);
}

async function clearVectors() {
  logInfo('Clearing existing vectors and metadata...');
  
  // Note: This would require Wrangler CLI access
  // For now, we'll just note that this should be done manually first
  logInfo('Run: wrangler d1 execute cv_assistant_db --remote --command="DELETE FROM vectors; DELETE FROM index_metadata;"');
}

async function indexBatch(offset, batchSize) {
  const response = await fetch(`${WORKER_URL}/index`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'technology',
      batchSize,
      offset
    })
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return await response.json();
}

async function checkHealth() {
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    const health = await response.json();
    return health;
  } catch (error) {
    return null;
  }
}

async function indexAllVectors() {
  logStep('1/3', 'Starting vector indexing process');
  logInfo(`Worker URL: ${WORKER_URL}`);
  logInfo(`Batch size: ${BATCH_SIZE}`);
  logInfo(`Total records: ${TOTAL_RECORDS}`);
  
  let totalProcessed = 0;
  const versions = [];
  
  for (let offset = 0; offset < TOTAL_RECORDS; offset += BATCH_SIZE) {
    const currentBatch = Math.min(BATCH_SIZE, TOTAL_RECORDS - offset);
    const percentage = Math.round((offset / TOTAL_RECORDS) * 100);
    
    logInfo(`Processing batch: offset=${offset}, size=${currentBatch} [${percentage}%]`);
    
    try {
      const result = await indexBatch(offset, currentBatch);
      
      if (!result.success) {
        logError(`Indexing failed at offset ${offset}: ${result.error}`);
        process.exit(1);
      }
      
      totalProcessed += result.processed;
      versions.push(result.version);
      
      logSuccess(`Batch complete: ${result.processed} records indexed (version ${result.version})`);
      
      // Small delay to avoid overwhelming the Worker
      if (offset + currentBatch < TOTAL_RECORDS) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    } catch (error) {
      logError(`Failed to index batch at offset ${offset}: ${error.message}`);
      process.exit(1);
    }
  }
  
  logStep('2/3', 'Indexing complete');
  logSuccess(`Total records processed: ${totalProcessed}`);
  logInfo(`Index versions created: ${versions.join(', ')}`);
  
  // Health check
  logStep('3/3', 'Verifying deployment');
  const health = await checkHealth();
  
  if (health) {
    if (health.status === 'healthy') {
      logSuccess('Worker is healthy');
      logInfo(`Database: ${health.database}`);
      logInfo(`Total skills: ${health.total_skills}`);
      if (health.last_index) {
        logInfo(`Last index: version ${health.last_index.version}, ${health.last_index.total_skills} skills indexed`);
      }
    } else {
      logError(`Worker health check failed: ${health.error || 'Unknown error'}`);
    }
  } else {
    logError('Could not reach worker health endpoint');
  }
  
  log('\n' + '='.repeat(60), colors.cyan);
  log('  INDEXING COMPLETE! 🎉', colors.green);
  log('='.repeat(60), colors.cyan);
  logInfo('All vectors have been generated and stored in D1');
  logInfo('Semantic search is now operational');
  console.log('');
}

// Main execution
(async () => {
  try {
    await indexAllVectors();
  } catch (error) {
    logError(`Unexpected error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
})();

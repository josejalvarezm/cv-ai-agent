#!/usr/bin/env node

/**
 * Cloudflare AI Gateway Analytics Fetcher
 * 
 * Queries the Cloudflare GraphQL Analytics API to fetch Workers AI usage metrics
 * via AI Gateway, including requests, tokens, errors, and cache hits.
 * 
 * Usage:
 *   node scripts/fetch-ai-analytics.js [--today|--week|--month] [--export]
 * 
 * Environment Variables Required:
 *   CLOUDFLARE_API_TOKEN - API token with Analytics:Read permission
 *   ACCOUNT_ID - Cloudflare account ID
 *   GATEWAY_NAME - AI Gateway name (default: cv-assistant-gateway)
 */

import 'dotenv/config';
import Table from 'cli-table3';
import { writeFileSync } from 'fs';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  apiToken: process.env.ANALYTICS_TOKEN || process.env.CLOUDFLARE_API_TOKEN,
  accountId: process.env.ACCOUNT_ID,
  gatewayName: process.env.GATEWAY_NAME || 'cv-assistant-gateway',
  graphqlEndpoint: 'https://api.cloudflare.com/client/v4/graphql',
};

// Validate required environment variables
function validateConfig() {
  const missing = [];
  if (!CONFIG.apiToken) missing.push('CLOUDFLARE_API_TOKEN');
  if (!CONFIG.accountId) missing.push('ACCOUNT_ID');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(v => console.error(`   - ${v}`));
    console.error('\nCreate a .env file with:');
    console.error('CLOUDFLARE_API_TOKEN=your_token_here');
    console.error('ACCOUNT_ID=your_account_id_here');
    console.error('GATEWAY_NAME=cv-assistant-gateway');
    process.exit(1);
  }
}

// ============================================================================
// Date Range Helpers
// ============================================================================

function getDateRange(period = 'today') {
  const now = new Date();
  const endDate = now.toISOString();
  let startDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1)).toISOString();
      break;
    default:
      startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
  }

  return { startDate, endDate };
}

// ============================================================================
// GraphQL Query
// ============================================================================

const AI_GATEWAY_QUERY = `
query AIGatewayAnalytics(
  $accountTag: string!
  $startDate: string!
  $endDate: string!
  $limit: Int!
) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      aiGatewayRequestsAdaptiveGroups(
        limit: $limit
        filter: { datetimeHour_geq: $startDate, datetimeHour_leq: $endDate }
        orderBy: [datetimeMinute_ASC]
      ) {
        count
        dimensions {
          model
          provider
          gateway
          ts: datetimeMinute
        }
      }
    }
  }
}
`;

// ============================================================================
// API Functions
// ============================================================================

async function fetchAIGatewayAnalytics(period = 'today') {
  validateConfig();
  
  const { startDate, endDate } = getDateRange(period);
  
  console.log('🔍 Fetching AI Gateway analytics...');
  console.log(`   Account: ${CONFIG.accountId}`);
  console.log(`   Gateway: ${CONFIG.gatewayName}`);
  console.log(`   Period: ${period} (${startDate} to ${endDate})`);
  console.log('');

  try {
    const response = await fetch(CONFIG.graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: AI_GATEWAY_QUERY,
        variables: {
          accountTag: CONFIG.accountId,
          startDate,
          endDate,
          limit: 1000
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    // Check for GraphQL errors
    if (result.errors) {
      console.error('❌ GraphQL Errors:');
      result.errors.forEach(err => console.error(`   ${err.message}`));
      throw new Error('GraphQL query failed');
    }

    // Extract data
    const accounts = result.data?.viewer?.accounts;
    if (!accounts || accounts.length === 0) {
      throw new Error('No account data returned');
    }

    const analyticsData = accounts[0].aiGatewayRequestsAdaptiveGroups || [];
    
    if (analyticsData.length === 0) {
      console.warn('⚠️  No analytics data found for this period.');
      console.warn('    Possible reasons:');
      console.warn('    - Gateway has not received any requests yet');
      console.warn('    - Analytics data has a 5-10 minute delay');
      console.warn('    - Gateway name or account ID is incorrect');
      return [];
    }

    return analyticsData;
    
  } catch (error) {
    console.error('❌ Error fetching analytics:');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('401')) {
      console.error('\n💡 Tip: Check your CLOUDFLARE_API_TOKEN is valid');
      console.error('   Required permissions: Account:Analytics:Read');
    } else if (error.message.includes('403')) {
      console.error('\n💡 Tip: Token missing Analytics:Read permission');
    } else if (error.message.includes('timeout')) {
      console.error('\n💡 Tip: Try again in a few moments');
    }
    
    throw error;
  }
}

// ============================================================================
// Data Processing
// ============================================================================

function processAnalyticsData(data) {
  // Group by hour and model
  const grouped = data.reduce((acc, item) => {
    const datetime = new Date(item.dimensions.ts || item.dimensions.datetime);
    const hour = datetime.toISOString().slice(0, 13) + ':00'; // YYYY-MM-DDTHH:00
    const model = item.dimensions.model || 'unknown';
    
    const key = `${hour}|${model}`;
    
    if (!acc[key]) {
      acc[key] = {
        hour,
        model,
        requests: 0,
        tokensIn: 0,
        tokensOut: 0,
        errors: 0,
        cacheHits: 0,
        cacheMisses: 0,
        costUSD: 0,
      };
    }
    
    // Aggregate sums - use count for requests since sum.requests doesn't exist
    acc[key].requests += item.count || 0;
    acc[key].tokensIn += item.sum?.tokensIn || 0;
    acc[key].tokensOut += item.sum?.tokensOut || 0;
    acc[key].errors += item.sum?.errors || 0;
    acc[key].cacheHits += item.sum?.cacheHits || 0;
    acc[key].cacheMisses += item.sum?.cacheMisses || 0;
    acc[key].costUSD += item.avg?.costUSD || 0;
    
    return acc;
  }, {});
  
  // Convert to array and sort by hour descending
  return Object.values(grouped).sort((a, b) => 
    b.hour.localeCompare(a.hour)
  );
}

function calculateTotals(processed) {
  return processed.reduce((totals, row) => {
    totals.requests += row.requests;
    totals.tokensIn += row.tokensIn;
    totals.tokensOut += row.tokensOut;
    totals.errors += row.errors;
    totals.cacheHits += row.cacheHits;
    totals.cacheMisses += row.cacheMisses;
    totals.costUSD += row.costUSD;
    return totals;
  }, {
    requests: 0,
    tokensIn: 0,
    tokensOut: 0,
    errors: 0,
    cacheHits: 0,
    cacheMisses: 0,
    costUSD: 0,
  });
}

// ============================================================================
// Display Functions
// ============================================================================

function displayTable(processed, totals) {
  const table = new Table({
    head: [
      'Hour (UTC)',
      'Model',
      'Requests',
      'Tokens In',
      'Tokens Out',
      'Errors',
      'Cache Hits',
      'Cache Miss',
      'Cost (USD)',
    ],
    colWidths: [18, 26, 10, 12, 12, 8, 12, 12, 12],
    style: {
      head: ['cyan', 'bold'],
      border: ['gray'],
    },
  });

  // Add data rows
  processed.forEach(row => {
    const modelShort = row.model.replace('@cf/meta/', '').replace('-instruct', '');
    const cacheRate = row.cacheHits + row.cacheMisses > 0
      ? ((row.cacheHits / (row.cacheHits + row.cacheMisses)) * 100).toFixed(1)
      : '0.0';
    
    table.push([
      row.hour.replace('T', ' ').slice(0, 16),
      modelShort,
      row.requests.toLocaleString(),
      row.tokensIn.toLocaleString(),
      row.tokensOut.toLocaleString(),
      row.errors.toLocaleString(),
      `${row.cacheHits} (${cacheRate}%)`,
      row.cacheMisses.toLocaleString(),
      `$${row.costUSD.toFixed(4)}`,
    ]);
  });

  // Add totals row
  const totalCacheRate = totals.cacheHits + totals.cacheMisses > 0
    ? ((totals.cacheHits / (totals.cacheHits + totals.cacheMisses)) * 100).toFixed(1)
    : '0.0';
  
  table.push([
    { colSpan: 2, content: '📊 TOTALS', hAlign: 'right' },
    totals.requests.toLocaleString(),
    totals.tokensIn.toLocaleString(),
    totals.tokensOut.toLocaleString(),
    totals.errors.toLocaleString(),
    `${totals.cacheHits} (${totalCacheRate}%)`,
    totals.cacheMisses.toLocaleString(),
    `$${totals.costUSD.toFixed(4)}`,
  ]);

  console.log(table.toString());
  console.log('');
}

function displaySummary(totals, processed) {
  const totalTokens = totals.tokensIn + totals.tokensOut;
  const avgTokensPerRequest = totals.requests > 0 
    ? (totalTokens / totals.requests).toFixed(1) 
    : 0;
  const errorRate = totals.requests > 0 
    ? ((totals.errors / totals.requests) * 100).toFixed(2) 
    : 0;
  const cacheHitRate = totals.cacheHits + totals.cacheMisses > 0
    ? ((totals.cacheHits / (totals.cacheHits + totals.cacheMisses)) * 100).toFixed(1)
    : 0;
  
  // Get unique models
  const models = [...new Set(processed.map(r => r.model))];
  
  console.log('📈 Summary');
  console.log('─'.repeat(60));
  console.log(`Total Requests:        ${totals.requests.toLocaleString()}`);
  console.log(`Total Tokens:          ${totalTokens.toLocaleString()} (${totals.tokensIn.toLocaleString()} in, ${totals.tokensOut.toLocaleString()} out)`);
  console.log(`Avg Tokens/Request:    ${avgTokensPerRequest}`);
  console.log(`Total Errors:          ${totals.errors.toLocaleString()} (${errorRate}%)`);
  console.log(`Cache Hit Rate:        ${cacheHitRate}% (${totals.cacheHits.toLocaleString()} hits, ${totals.cacheMisses.toLocaleString()} misses)`);
  console.log(`Total Cost:            $${totals.costUSD.toFixed(4)}`);
  console.log(`Models Used:           ${models.length} (${models.join(', ')})`);
  console.log('─'.repeat(60));
  console.log('');
}

// ============================================================================
// Export Functions
// ============================================================================

function exportToJSON(processed, totals, filename = 'ai-analytics.json') {
  const exportData = {
    generatedAt: new Date().toISOString(),
    config: {
      accountId: CONFIG.accountId,
      gatewayName: CONFIG.gatewayName,
    },
    summary: totals,
    data: processed,
  };
  
  writeFileSync(filename, JSON.stringify(exportData, null, 2));
  console.log(`✅ Exported to ${filename}`);
}

function exportToCSV(processed, filename = 'ai-analytics.csv') {
  const headers = [
    'Hour (UTC)',
    'Model',
    'Requests',
    'Tokens In',
    'Tokens Out',
    'Errors',
    'Cache Hits',
    'Cache Misses',
    'Cost (USD)',
  ];
  
  const rows = processed.map(row => [
    row.hour,
    row.model,
    row.requests,
    row.tokensIn,
    row.tokensOut,
    row.errors,
    row.cacheHits,
    row.cacheMisses,
    row.costUSD.toFixed(6),
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
  
  writeFileSync(filename, csv);
  console.log(`✅ Exported to ${filename}`);
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  
  const options = {
    period: 'today',
    export: false,
    format: 'json',
  };
  
  args.forEach(arg => {
    if (arg === '--today') options.period = 'today';
    else if (arg === '--week') options.period = 'week';
    else if (arg === '--month') options.period = 'month';
    else if (arg === '--export') options.export = true;
    else if (arg === '--json') options.format = 'json';
    else if (arg === '--csv') options.format = 'csv';
    else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  });
  
  return options;
}

function showHelp() {
  console.log(`
🔍 Cloudflare AI Gateway Analytics Fetcher

Usage:
  node scripts/fetch-ai-analytics.js [options]

Options:
  --today       Fetch today's analytics (default)
  --week        Fetch last 7 days
  --month       Fetch last 30 days
  --export      Export data to file
  --json        Export as JSON (default)
  --csv         Export as CSV
  --help, -h    Show this help message

Environment Variables:
  CLOUDFLARE_API_TOKEN   Required - API token with Analytics:Read permission
  ACCOUNT_ID             Required - Your Cloudflare account ID
  GATEWAY_NAME           Optional - AI Gateway name (default: cv-assistant-gateway)

Examples:
  npm run analytics                    # Today's analytics
  npm run analytics:week               # Last 7 days
  node scripts/fetch-ai-analytics.js --week --export --csv

Documentation:
  See AI_GATEWAY_ANALYTICS_ROADMAP.md for setup instructions
  `);
}

// ============================================================================
// Main Function
// ============================================================================

async function main() {
  try {
    const options = parseArgs();
    
    console.log('');
    console.log('═'.repeat(60));
    console.log('  🚀 Cloudflare AI Gateway Analytics');
    console.log('═'.repeat(60));
    console.log('');
    
    // Fetch data
    const rawData = await fetchAIGatewayAnalytics(options.period);
    
    if (rawData.length === 0) {
      console.log('ℹ️  No data to display');
      return;
    }
    
    // Process data
    const processed = processAnalyticsData(rawData);
    const totals = calculateTotals(processed);
    
    // Display results
    displayTable(processed, totals);
    displaySummary(totals, processed);
    
    // Export if requested
    if (options.export) {
      const timestamp = new Date().toISOString().slice(0, 10);
      if (options.format === 'csv') {
        exportToCSV(processed, `ai-analytics-${timestamp}.csv`);
      } else {
        exportToJSON(processed, totals, `ai-analytics-${timestamp}.json`);
      }
    }
    
    console.log('✅ Done!');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('💥 Fatal error:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Run if called directly
// Handle both module and direct execution
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].includes('fetch-ai-analytics.js')) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { fetchAIGatewayAnalytics, processAnalyticsData };

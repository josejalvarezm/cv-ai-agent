/**
 * Automated test runner for CV Assistant
 */

const fs = require('fs');
const path = require('path');

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const TEST_FILE = path.join(__dirname, 'test-queries.json');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function loadTestQueries() {
  const content = fs.readFileSync(TEST_FILE, 'utf-8');
  return JSON.parse(content);
}

async function testQuery(queryTest) {
  const url = `${WORKER_URL}/query?q=${encodeURIComponent(queryTest.query)}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Request failed',
        query: queryTest.query,
      };
    }
    
    if (!data.results || !Array.isArray(data.results)) {
      return {
        success: false,
        error: 'Invalid response structure',
        query: queryTest.query,
      };
    }
    
    const resultNames = data.results.map(r => r.name);
    const matchedSkills = queryTest.expected_skills.filter(skill => 
      resultNames.some(name => name.toLowerCase().includes(skill.toLowerCase()) || 
                              skill.toLowerCase().includes(name.toLowerCase()))
    );
    
    return {
      success: true,
      query: queryTest.query,
      expected: queryTest.expected_skills,
      matched: matchedSkills,
      results: data.results,
      source: data.source,
      cached: data.cached,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      query: queryTest.query,
    };
  }
}

async function runTests() {
  console.log(`${colors.blue}=== CV Assistant Test Runner ===${colors.reset}\n`);
  console.log(`Worker URL: ${WORKER_URL}\n`);
  
  const testData = loadTestQueries();
  const queries = testData.queries;
  
  console.log(`Running ${queries.length} test queries...\n`);
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const queryTest of queries) {
    process.stdout.write(`Test ${queryTest.id}: "${queryTest.query}"... `);
    
    const result = await testQuery(queryTest);
    results.push(result);
    
    if (result.success) {
      const matchRate = result.matched.length / result.expected.length;
      if (matchRate >= 0.33) {
        console.log(`${colors.green}✓ PASS${colors.reset} (${result.matched.length}/${result.expected.length} matched)`);
        passed++;
      } else {
        console.log(`${colors.yellow}⚠ PARTIAL${colors.reset} (${result.matched.length}/${result.expected.length} matched)`);
        passed++;
      }
    } else {
      console.log(`${colors.red}✗ FAIL${colors.reset} - ${result.error}`);
      failed++;
    }
  }
  
  console.log(`\n${colors.blue}=== Test Summary ===${colors.reset}`);
  console.log(`Total: ${queries.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Success Rate: ${((passed / queries.length) * 100).toFixed(1)}%\n`);
  
  if (failed > 0) {
    console.log(`${colors.yellow}Failed Tests:${colors.reset}`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - "${r.query}": ${r.error}`);
    });
    console.log('');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error(`${colors.red}Test runner error:${colors.reset}`, error);
  process.exit(1);
});
/**
 * SecureMint Engine - K6 Load Testing Suite
 * Stress testing for SecureMint API and RPC endpoints
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  RPC_URL: __ENV.RPC_URL || 'http://localhost:8545',
  API_URL: __ENV.API_URL || 'http://localhost:3000',
  CHAIN_ID: __ENV.CHAIN_ID || '1',
  TOKEN_ADDRESS: __ENV.TOKEN_ADDRESS || '0x0000000000000000000000000000000000000000',
  POLICY_ADDRESS: __ENV.POLICY_ADDRESS || '0x0000000000000000000000000000000000000000',
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════════════════

// Counters
const mintAttempts = new Counter('mint_attempts');
const mintSuccesses = new Counter('mint_successes');
const mintFailures = new Counter('mint_failures');
const rpcCalls = new Counter('rpc_calls');

// Rates
const errorRate = new Rate('error_rate');
const mintSuccessRate = new Rate('mint_success_rate');

// Trends
const mintLatency = new Trend('mint_latency', true);
const rpcLatency = new Trend('rpc_latency', true);
const oracleQueryLatency = new Trend('oracle_query_latency', true);
const invariantCheckLatency = new Trend('invariant_check_latency', true);

// Gauges
const currentTPS = new Gauge('current_tps');
const activeUsers = new Gauge('active_users');

// ═══════════════════════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════════════════════

const testAddresses = new SharedArray('test_addresses', function () {
  const addresses = [];
  for (let i = 0; i < 1000; i++) {
    addresses.push('0x' + Math.random().toString(16).substring(2, 42).padEnd(40, '0'));
  }
  return addresses;
});

const mintAmounts = [
  1000000,      // 1 USDC
  10000000,     // 10 USDC
  100000000,    // 100 USDC
  1000000000,   // 1000 USDC
  10000000000,  // 10000 USDC
];

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════════

export const options = {
  scenarios: {
    // Scenario 1: Smoke Test (Sanity check)
    smoke_test: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
      exec: 'smokeTest',
    },

    // Scenario 2: Load Test (Normal load)
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 50 },   // Sustain
        { duration: '2m', target: 0 },    // Ramp down
      ],
      tags: { scenario: 'load' },
      exec: 'loadTest',
      startTime: '30s',
    },

    // Scenario 3: Stress Test (Find breaking point)
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '5m', target: 300 },
        { duration: '2m', target: 0 },
      ],
      tags: { scenario: 'stress' },
      exec: 'stressTest',
      startTime: '10m',
    },

    // Scenario 4: Spike Test (Sudden load)
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 0 },
        { duration: '10s', target: 500 }, // Spike!
        { duration: '30s', target: 500 },
        { duration: '10s', target: 0 },
      ],
      tags: { scenario: 'spike' },
      exec: 'spikeTest',
      startTime: '35m',
    },

    // Scenario 5: Soak Test (Endurance)
    soak_test: {
      executor: 'constant-vus',
      vus: 30,
      duration: '30m',
      tags: { scenario: 'soak' },
      exec: 'soakTest',
      startTime: '40m',
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    mint_success_rate: ['rate>0.95'],
    error_rate: ['rate<0.05'],
    rpc_latency: ['p(95)<200'],
    mint_latency: ['p(95)<2000'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// RPC HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function rpcCall(method, params = []) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params,
    id: Date.now(),
  });

  const response = http.post(CONFIG.RPC_URL, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'rpc_' + method },
  });

  rpcCalls.add(1);
  rpcLatency.add(response.timings.duration);

  return response;
}

function ethCall(to, data) {
  return rpcCall('eth_call', [{ to, data }, 'latest']);
}

function getBlockNumber() {
  return rpcCall('eth_blockNumber');
}

function getTotalSupply() {
  // totalSupply() selector
  return ethCall(CONFIG.TOKEN_ADDRESS, '0x18160ddd');
}

function getBacking() {
  // getLatestBacking() selector
  return ethCall(CONFIG.POLICY_ADDRESS, '0xabcd1234');
}

// ═══════════════════════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function apiGet(endpoint) {
  return http.get(`${CONFIG.API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'api_' + endpoint.replace(/\//g, '_') },
  });
}

function apiPost(endpoint, body) {
  return http.post(`${CONFIG.API_URL}${endpoint}`, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'api_' + endpoint.replace(/\//g, '_') },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function smokeTest() {
  group('Smoke Test', function () {
    // Basic RPC connectivity
    const blockRes = getBlockNumber();
    check(blockRes, {
      'RPC: block number returned': (r) => r.status === 200,
      'RPC: valid response': (r) => JSON.parse(r.body).result !== undefined,
    });

    // Basic API connectivity
    const healthRes = apiGet('/health');
    check(healthRes, {
      'API: health endpoint ok': (r) => r.status === 200,
    });

    // Oracle query
    const start = Date.now();
    const backingRes = getBacking();
    oracleQueryLatency.add(Date.now() - start);

    check(backingRes, {
      'Oracle: backing query ok': (r) => r.status === 200,
    });

    sleep(1);
  });
}

export function loadTest() {
  group('Load Test - Normal Operations', function () {
    const recipient = randomItem(testAddresses);
    const amount = randomItem(mintAmounts);

    // Check invariants first
    const invStart = Date.now();
    const supplyRes = getTotalSupply();
    const backingRes = getBacking();
    invariantCheckLatency.add(Date.now() - invStart);

    check(supplyRes, {
      'Supply query ok': (r) => r.status === 200,
    });

    // Simulate mint request
    mintAttempts.add(1);
    const mintStart = Date.now();

    const mintRes = apiPost('/api/mint/simulate', {
      recipient,
      amount: amount.toString(),
    });

    const mintDuration = Date.now() - mintStart;
    mintLatency.add(mintDuration);

    const success = check(mintRes, {
      'Mint simulation ok': (r) => r.status === 200 || r.status === 201,
      'Mint response valid': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success !== undefined;
        } catch {
          return false;
        }
      },
    });

    if (success) {
      mintSuccesses.add(1);
      mintSuccessRate.add(1);
    } else {
      mintFailures.add(1);
      mintSuccessRate.add(0);
    }

    errorRate.add(!success);
    sleep(randomIntBetween(1, 3));
  });
}

export function stressTest() {
  group('Stress Test - High Load', function () {
    const operations = ['mint', 'burn', 'transfer', 'query'];
    const operation = randomItem(operations);

    switch (operation) {
      case 'mint':
        apiPost('/api/mint/simulate', {
          recipient: randomItem(testAddresses),
          amount: randomItem(mintAmounts).toString(),
        });
        break;

      case 'burn':
        apiPost('/api/burn/simulate', {
          holder: randomItem(testAddresses),
          amount: randomItem(mintAmounts).toString(),
        });
        break;

      case 'transfer':
        apiPost('/api/transfer/simulate', {
          from: randomItem(testAddresses),
          to: randomItem(testAddresses),
          amount: randomItem(mintAmounts).toString(),
        });
        break;

      case 'query':
        const queries = [
          () => getTotalSupply(),
          () => getBacking(),
          () => getBlockNumber(),
          () => apiGet('/api/stats'),
        ];
        randomItem(queries)();
        break;
    }

    sleep(randomIntBetween(0, 1));
  });
}

export function spikeTest() {
  group('Spike Test - Burst Traffic', function () {
    // Rapid-fire requests
    for (let i = 0; i < 5; i++) {
      getTotalSupply();
      getBacking();
    }

    apiPost('/api/mint/simulate', {
      recipient: randomItem(testAddresses),
      amount: randomItem(mintAmounts).toString(),
    });
  });
}

export function soakTest() {
  group('Soak Test - Sustained Load', function () {
    // Mix of operations over long period
    const rand = Math.random();

    if (rand < 0.4) {
      // 40% - Query operations
      getTotalSupply();
      getBacking();
    } else if (rand < 0.7) {
      // 30% - Mint simulations
      apiPost('/api/mint/simulate', {
        recipient: randomItem(testAddresses),
        amount: randomItem(mintAmounts).toString(),
      });
    } else if (rand < 0.9) {
      // 20% - API queries
      apiGet('/api/stats');
      apiGet('/api/oracle/status');
    } else {
      // 10% - Compliance checks
      apiPost('/api/compliance/check', {
        address: randomItem(testAddresses),
      });
    }

    sleep(randomIntBetween(1, 5));
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIFECYCLE HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function setup() {
  console.log('Starting SecureMint Load Tests');
  console.log(`RPC URL: ${CONFIG.RPC_URL}`);
  console.log(`API URL: ${CONFIG.API_URL}`);

  // Verify connectivity
  const rpcCheck = getBlockNumber();
  if (rpcCheck.status !== 200) {
    throw new Error('RPC not reachable');
  }

  const apiCheck = apiGet('/health');
  if (apiCheck.status !== 200) {
    console.warn('API health check failed - some tests may fail');
  }

  return {
    startTime: Date.now(),
    initialBlock: JSON.parse(rpcCheck.body).result,
  };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nTest completed in ${duration.toFixed(2)} seconds`);
  console.log(`Started at block: ${data.initialBlock}`);

  // Get final block
  const finalBlock = getBlockNumber();
  console.log(`Ended at block: ${JSON.parse(finalBlock.body).result}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANDALONE EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

export default function () {
  loadTest();
}

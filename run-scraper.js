#!/usr/bin/env node

require('dotenv').config();

const ScraperOrchestrator = require('./orchestrator');

async function main() {
  try {
    console.log(`[${new Date().toISOString()}] Starting single-pass scraper run...`);

    const orchestrator = new ScraperOrchestrator();
    await orchestrator.runAllScrapers();

    console.log(`[${new Date().toISOString()}] Scraper run completed successfully`);
    process.exit(0);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Scraper run failed:`, error);
    process.exit(1);
  }
}

main();

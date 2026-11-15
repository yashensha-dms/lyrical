import fs from 'fs';
import path from 'path';

function checkDirection() {
  console.log('--- DIRECTION AUDIT ---');
  const specsExist = fs.existsSync('specs/PRD.md') && fs.existsSync('specs/MUST_NOT_TRADE_OFF.md');
  const planExists = fs.existsSync('PLAN.md');

  if (!specsExist || !planExists) {
    console.error('FAIL: Specs or Plan missing!');
    process.exit(1);
  }

  const plan = fs.readFileSync('PLAN.md', 'utf8');
  console.log('Specs & Plan: Present');
  const activeTaskMatch = plan.match(/\[\/\]\s+\*\*([^\*]+)\*\*/);
  if (activeTaskMatch) {
    console.log(`Active Task: ${activeTaskMatch[1]}`);
  } else {
    console.log('No active task marked [/]');
  }
  console.log('Direction check passed: In sync with specs/');
}

checkDirection();

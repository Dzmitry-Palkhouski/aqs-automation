// New Antique Auto Dealers PACKAGE policy with Crime / Employee Theft, rated
// (and issued when STOP_AFTER=issue). Mirrors the manual run of 2026-11-25.
// Run: npx ts-node tests/crime-policy.test.ts
import * as assert from 'assert';
import { createDriver } from '../src/driver';
import { actionOpensWindow, click, type, waitForReady } from '../src/aqs';
import {
  addLocationFromInsured,
  assertPathIdFree,
  fillPolicyInformation,
  handleAppMessage,
  issue,
  moneyOf,
  openAqsHome,
  rate,
  startNewPolicy,
} from '../src/flows';
import { L } from '../src/locators';
import { CONFIG } from '../src/config';

async function main() {
  const pathId = CONFIG.newPathId;
  console.log(`Path ID ${pathId}`);
  const driver = await createDriver(CONFIG.aqsStartUrl);
  try {
    await openAqsHome(driver, CONFIG.aqsStartUrl);
    await assertPathIdFree(driver, pathId);
    await startNewPolicy(driver, pathId, 'Antique Auto Dealers');

    // Keep the CA address the Path ID prefills; Crime rated fine in CA.
    await fillPolicyInformation(driver, {
      policyType: 'PACKAGE',
      pmaDescription: 'NA - NOT APPLICABLE',
      businessType: 'PARTNERSHIP',
      profession: 'Antique Auto Dealers',
      insured: { name: 'Auto Crime Test', street1: '1212 Whipple Ave', city: 'Redwood City', state: 'CA', zip: '94062' },
    });
    await addLocationFromInsured(driver);

    // LOB: Crime → defaults → CA class (first lookup result) → Employee Theft.
    await click(driver, L('tree.lobActionMenu'));
    await waitForReady(driver);
    await click(driver, L('lob.row.crime'));
    await click(driver, L('lob.add'));
    await waitForReady(driver);
    await click(driver, L('crime.policy.next'));
    await waitForReady(driver);

    const stateWindow = await driver.getWindowHandle();
    await actionOpensWindow(driver, () => click(driver, L('crime.state.addClass')));
    await click(driver, L('crimeClass.search')); // empty search: >100 matches message, list still filled
    const lookupWindow = await driver.getWindowHandle();
    await handleAppMessage(driver, 'ok', 10_000); // ">100 matches, narrow your search"
    await driver.switchTo().window(lookupWindow);
    await click(driver, L('crimeClass.firstRow'));
    await click(driver, L('crimeClass.select'));
    await click(driver, L('crimeClass.ok'));
    await driver.switchTo().window(stateWindow);
    await waitForReady(driver);
    await click(driver, L('crime.state.next'));
    await waitForReady(driver);

    await click(driver, L('unitCov.available.employeeTheft'));
    await actionOpensWindow(driver, () => click(driver, L('unitCov.select')));
    await type(driver, L('employeeTheft.limit'), '25000');
    await type(driver, L('employeeTheft.ratableEmployees'), '5');
    await click(driver, L('employeeTheft.ok'));
    await driver.switchTo().window(stateWindow);
    await click(driver, L('unitCov.done'));
    await waitForReady(driver);

    const result = await rate(driver);
    assert.deepStrictEqual(result.errors, [], `rating errors: ${result.errors.join(' | ')}`);
    const crime = await moneyOf(driver, 'lob.premium.crime');
    const total = await moneyOf(driver, 'lob.total');
    console.log(`Crime premium ${crime}, total ${total}`);
    // Baseline from 2026-11-25 (same inputs, CA): $134. A different value is a
    // rate change or an input difference, not automatically a defect.
    assert.ok(crime > 0, 'Crime premium is zero');

    if (CONFIG.stopAfter === 'issue') {
      const policyNumber = await issue(driver);
      assert.strictEqual(policyNumber, `P${pathId}`, 'unexpected issued policy number');
      console.log(`Issued ${policyNumber}`);
    }
    console.log('PASS');
  } finally {
    await driver.quit();
  }
}

main().catch((e) => {
  console.error('FAIL:', e.message ?? e);
  process.exit(1);
});

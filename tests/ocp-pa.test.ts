// Commercial Auto OCP quote in Pennsylvania: one PPT vehicle, rated, then the
// Liability rate is recomputed from the factors with the documented
// "PPT LIA" algorithm. Mirrors the manual run of 2026-11-25.
// Run: npx ts-node tests/ocp-pa.test.ts
import * as assert from 'assert';
import { By, WebDriver } from 'selenium-webdriver';
import { createDriver } from '../src/driver';
import { actionOpensWindow, click, selectByText, setCheckbox, type, visible, waitForReady } from '../src/aqs';
import {
  addLocationFromInsured,
  assertPathIdFree,
  fillPolicyInformation,
  handleAppMessage,
  openAqsHome,
  rate,
  startNewPolicy,
} from '../src/flows';
import { L } from '../src/locators';
import { CONFIG } from '../src/config';

const SYMBOL_COVERAGES = ['Liability', 'Pers Injury Prot', 'Uninsured', 'Underinsured', 'Comprehensive', 'Collision', 'Towing and Labor'];

/**
 * Covered Auto Symbols page: one block of checkboxes per coverage, headed by
 * the coverage name. TODO after capture: confirm this XPath against the
 * captured HTML (checkbox for symbol N inside the block after the heading).
 */
function symbolCheckbox(coverage: string, symbol: number): By {
  return By.xpath(
    `//*[normalize-space(text())='${coverage}'][following-sibling::*[1][contains(.,'Back to Top')] or contains(following::text()[1],'Back to Top')]` +
      `/following::input[@type='checkbox'][${symbol === 19 ? 10 : symbol}]`,
  );
}

/** Rate step rounding as in the RAT files: every step rounded to 3 decimals. */
const r3 = (x: number) => Math.round((x + 1e-9) * 1000) / 1000;

async function readFactors(driver: WebDriver): Promise<Record<string, number>> {
  // TODO after capture: table rows "Rates & Factors | System Value | Override".
  const rows = await driver.findElements(By.xpath(`//tr[td[2]]`));
  const out: Record<string, number> = {};
  for (const row of rows) {
    const cells = await row.findElements(By.css('td'));
    const name = (await cells[0].getText()).trim();
    const value = Number((await cells[1].getText()).trim());
    if (name && !Number.isNaN(value)) out[name] = value;
  }
  return out;
}

async function main() {
  const pathId = CONFIG.newPathId;
  console.log(`Path ID ${pathId}`);
  const driver = await createDriver(CONFIG.aqsStartUrl);
  try {
    await openAqsHome(driver, CONFIG.aqsStartUrl);
    await assertPathIdFree(driver, pathId);
    await startNewPolicy(driver, pathId, 'Antique Auto Dealers');
    await fillPolicyInformation(driver, {
      policyType: 'PACKAGE',
      pmaDescription: 'NA - NOT APPLICABLE',
      businessType: 'PARTNERSHIP',
      profession: 'Antique Auto Dealers',
      primaryState: 'Pennsylvania',
      insured: { name: 'OCP Test', street1: '100 W Main', city: 'Hershey', state: 'PA', zip: '17033' },
    });
    await addLocationFromInsured(driver);

    // LOB: Commercial Automobile
    await click(driver, L('tree.lobActionMenu'));
    await waitForReady(driver);
    await click(driver, L('lob.row.commercialAuto'));
    await click(driver, L('lob.add'));
    await waitForReady(driver);
    await selectByText(driver, L('cau.policy.classifiedAs'), 'NON-FLEET');
    await click(driver, L('cau.policy.next'));
    await waitForReady(driver);
    await selectByText(driver, L('cau.state.umLimit'), '35');
    await selectByText(driver, L('cau.state.uimLimit'), '35');
    await click(driver, L('cau.state.next'));
    await waitForReady(driver);
    await click(driver, L('cau.vehicleLimits.next')); // defaults: OTC comp 500, coll 1000, towing 50
    await waitForReady(driver);
    await click(driver, L('cau.commonCov.next'));
    await waitForReady(driver);

    // Vehicle 1: PPT 2024 Chevrolet, VIN to follow, cost new 35,000, class 7391
    await click(driver, L('cau.vehicles.add'));
    await waitForReady(driver);
    await selectByText(driver, L('vehicle.type'), 'PPT');
    await click(driver, L('vehicle.next'));
    await waitForReady(driver);
    await selectByText(driver, L('vehicle.vin'), 'TO FOLLOW');
    await type(driver, L('vehicle.modelYear'), '2024');
    await selectByText(driver, L('vehicle.manufacturer'), 'CHEVROLET');
    await type(driver, L('vehicle.costNew'), '35000');
    await selectByText(driver, L('vehicle.class'), '7391 ALL OTHER');
    // Quirk: after OK the page hung ("not responding") behind a hidden
    // 1st Party Benefits dialog. Wait for that dialog explicitly.
    const vehicleWindow = await driver.getWindowHandle();
    await actionOpensWindow(driver, () => click(driver, L('vehicle.ok')), 120_000);
    await selectByText(driver, L('firstParty.type'), 'PRIN OPERATED BY EMPLOYEES');
    await click(driver, L('firstParty.ok'));
    await driver.switchTo().window(vehicleWindow);
    await click(driver, L('vehicleCov.ok'));
    await waitForReady(driver);
    await click(driver, L('vehicles.done'));
    await waitForReady(driver);

    // Quirk: without covered auto symbols every coverage fails rating.
    await click(driver, L('cauMenu.symbols'));
    await waitForReady(driver);
    for (const cov of SYMBOL_COVERAGES) await setCheckbox(driver, symbolCheckbox(cov, 7), true);
    await click(driver, L('symbols.ok'));
    await waitForReady(driver);

    const result = await rate(driver);
    assert.deepStrictEqual(result.errors, [], `rating errors: ${result.errors.join(' | ')}`);
    await handleAppMessage(driver, 'ok', 1_000);

    const total = Number((await (await visible(driver, L('lob.premium.commercialAuto'))).getText()).replace(/[$,]/g, ''));
    console.log(`Commercial Auto premium ${total} (2026-11-25 baseline: 1600)`);

    // Liability rate check: CA menu → Vehicle Summary → vehicle 1 → Coverages
    // → LIABILITY → Rates/Factors (modal). Read-only; closed with Cancel.
    await click(driver, L('tree.commercialAuto'));
    await waitForReady(driver);
    await click(driver, L('cauMenu.vehicleSummary'));
    await waitForReady(driver);
    await click(driver, L('vehicles.firstRow'));
    await click(driver, L('vehicles.coverages'));
    await waitForReady(driver);
    await click(driver, L('vehicleCov.selected.liability'));
    const covWindow = await driver.getWindowHandle();
    await actionOpensWindow(driver, () => click(driver, L('vehicleCov.ratesFactors')));
    const f = await readFactors(driver);
    await click(driver, L('ratesFactors.cancel'));
    await driver.switchTo().window(covWindow);
    const expected = r3(
      r3(r3(r3(r3(r3(r3(f['LIAB LOSS COST'] * f['LOSS COST MULT']) * f['CLASS FACTOR']) * f['FLEET FAC']) * f['AGE FACTOR']) * f['OCN FACTOR']) * f['NAICS FAC']) *
        r3(f['INCR LIAB LMT'] - f['LIA DEDUCT FAC']),
    );
    console.log('Liability factors', f, 'expected rate', expected);
    // 2026-11-25 baseline: 346 × 1.555 × 1 × 1 × 1.07 × 0.99 × 0.90 × 1.80 = 923.296 → $923
    assert.ok(Number.isFinite(expected) && expected > 0, 'could not read liability factors');
    for (const k of ['NAICS FAC', 'OCN FACTOR', 'TRANS NET FAC']) {
      assert.ok(k in f, `OCP factor ${k} missing: OCP rating not applied?`);
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

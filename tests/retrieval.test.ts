// TC-MTE-POLICY-RETRIEVAL-001: TestHarness → Policy Retrieval (REST) → validate JSON identity.
// Run: npx ts-node tests/retrieval.test.ts
import * as assert from 'assert';
import * as fs from 'fs';
import { createDriver } from '../src/driver';
import { click, setCheckbox, snapshotDownloads, type, visible, waitForDownload } from '../src/aqs';
import { ensureHarnessLogin } from '../src/flows';
import { L } from '../src/locators';
import { CONFIG } from '../src/config';

async function main() {
  const { policyNumber, expectedPolicyId } = CONFIG.retrieval;
  const driver = await createDriver(CONFIG.harnessRetrievalUrl);
  try {
    await ensureHarnessLogin(driver, CONFIG.harnessRetrievalUrl);

    // Quirk: the form opens with SOAP; clicking the REST circle did not always
    // switch it (the label click did). Click, then assert the state.
    await click(driver, L('retrieval.requestType.rest'));
    assert.ok(await (await visible(driver, L('retrieval.requestType.rest'))).isSelected(), 'REST not selected');

    await type(driver, L('retrieval.policyId'), '');
    await type(driver, L('retrieval.policyNumber'), policyNumber);
    await setCheckbox(driver, L('retrieval.transactional'), false);
    await setCheckbox(driver, L('retrieval.smartCommFilter'), false);

    // Output Format is disabled under REST and shows xml-v1, yet JSON is returned. Record only.
    const fmt = await visible(driver, L('retrieval.outputFormat'));
    console.log(`Output Format: "${await fmt.getAttribute('value')}" enabled=${await fmt.isEnabled()}`);

    const before = snapshotDownloads();
    const t0 = Date.now();
    await click(driver, L('retrieval.execute')); // exactly once, no retry

    // Known gap: Edge IE mode may show an Open/Save bar that Selenium cannot
    // click. If the file does not appear, set the Edge download policy on the
    // VM or click Save by hand within the wait.
    const file = await waitForDownload(before, new RegExp(`^PolNum=${policyNumber}.*\\.json$`), 90_000);
    console.log(`Downloaded ${file} after ${Date.now() - t0} ms`);

    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(doc.Policy, 'no Policy object: error payload or wrong document');
    assert.strictEqual(String(doc.Policy.PolicyNumber), policyNumber, 'PolicyNumber mismatch');
    const policyId = doc.Policy.TransactionInfo?.PolicyId;
    if (policyId !== undefined) {
      assert.strictEqual(String(policyId), expectedPolicyId, 'TransactionInfo.PolicyId mismatch');
    }
    const premiums: Array<{ PremiumCd?: string; Value?: string }> = doc.Policy.Premium ?? [];
    console.log(`Premium entries: ${premiums.map((p) => `${p.PremiumCd}=${p.Value}`).join(', ') || 'none'}`);
    console.log('PASS');
  } finally {
    await driver.quit();
  }
}

main().catch((e) => {
  console.error('FAIL:', e.message ?? e);
  process.exit(1);
});

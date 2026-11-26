// AQS business steps shared by the tests. Each step encodes a quirk found
// during the manual investigation on 2026-11-25 (see comments).
import { By, WebDriver } from 'selenium-webdriver';
import {
  DEFAULT_TIMEOUT,
  actionOpensWindow,
  click,
  selectByText,
  sleep,
  switchToWindowTitled,
  type,
  visible,
  waitForReady,
  xpathLiteral,
} from './aqs';
import { L } from './locators';

/**
 * AQS confirmations/warnings are "Application Message -- Webpage Dialog"
 * modal windows, not JS alerts. Returns their text, or undefined if none
 * appeared within `timeout`.
 */
export async function handleAppMessage(
  driver: WebDriver,
  answer: 'ok' | 'yes',
  timeout = 5_000,
): Promise<string | undefined> {
  const owner = await driver.getWindowHandle();
  try {
    await switchToWindowTitled(driver, /Application Message/, timeout);
  } catch {
    return undefined;
  }
  const text = await (await visible(driver, L('appMessage.text'))).getText();
  await click(driver, L(answer === 'yes' ? 'appMessage.yes' : 'appMessage.ok'));
  await driver.switchTo().window(owner);
  return text;
}

/**
 * Product Code / Primary State are filterable combo boxes. If the capture
 * shows a native <select>, selectByText is used; otherwise the text is typed
 * and the matching list item clicked.
 * Quirk: typing a prefix selected the neighbour ("Antique Auto Umbrella"),
 * so always verify the final value.
 */
export async function chooseCombo(driver: WebDriver, by: By, text: string) {
  const el = await visible(driver, by);
  if ((await el.getTagName()).toLowerCase() === 'select') {
    await selectByText(driver, by, text);
    return;
  }
  await el.clear();
  await el.sendKeys(text);
  const item = await visible(
    driver,
    By.xpath(`//*[self::li or self::div or self::td or self::option][normalize-space(.)=${xpathLiteral(text)}]`),
    10_000,
  );
  await item.click();
  await driver.wait(
    async () => ((await el.getAttribute('value')) ?? '').trim() === text,
    5_000,
    `combo ${by} did not end up with "${text}" (prefix typing can select a neighbour item)`,
  );
}

/**
 * Start page → Policy Administration → login popup → Home window.
 * Credentials come from AQS_USER / AQS_PASSWORD (local env, never committed).
 * Without them the test waits up to 3 minutes for a manual login.
 */
export async function openAqsHome(driver: WebDriver, startUrl: string) {
  await driver.get(startUrl);
  await waitForReady(driver);
  await actionOpensWindow(driver, () => click(driver, L('start.policyAdministration')), 60_000);
  const user = process.env.AQS_USER;
  const password = process.env.AQS_PASSWORD;
  if (user && password) {
    await type(driver, L('login.user'), user);
    await type(driver, L('login.password'), password);
    await click(driver, L('login.ok'));
  } else {
    console.log('AQS_USER/AQS_PASSWORD not set: log in manually in the AQS login window (3 min).');
  }
  await switchToWindowTitled(driver, /AQS\/advantage Home Page/, 180_000);
  await driver.manage().window().maximize();
  await waitForReady(driver);
}

/** TestHarness redirects to /Account/LogOn when the session is missing. */
export async function ensureHarnessLogin(driver: WebDriver, targetUrl: string) {
  await driver.get(targetUrl);
  await waitForReady(driver);
  if (!/\/Account\/LogOn/i.test(await driver.getCurrentUrl())) return;
  const user = process.env.HARNESS_USER ?? process.env.AQS_USER;
  const password = process.env.HARNESS_PASSWORD ?? process.env.AQS_PASSWORD;
  if (user && password) {
    await type(driver, L('harnessLogin.user'), user);
    await type(driver, L('harnessLogin.password'), password);
    await click(driver, L('harnessLogin.submit'));
  } else {
    console.log('HARNESS_USER/HARNESS_PASSWORD not set: log in manually in the browser (3 min).');
  }
  await driver.wait(
    async () => !/\/Account\/LogOn/i.test(await driver.getCurrentUrl()),
    180_000,
    'still on TestHarness LogOn page',
  );
  await driver.get(targetUrl);
  await waitForReady(driver);
}

/** Fails fast if a Path ID already exists (All Policies shows "No matches found" when free). */
export async function assertPathIdFree(driver: WebDriver, pathId: string) {
  await click(driver, L('home.allPolicies'));
  await waitForReady(driver);
  await type(driver, L('allPolicies.policyNumber'), pathId);
  await click(driver, L('allPolicies.retrieve'));
  const msg = await handleAppMessage(driver, 'ok', 10_000);
  if (!msg || !/No matches found/i.test(msg)) {
    throw new Error(`Path ID ${pathId} seems to exist already (message: ${msg ?? 'none'})`);
  }
}

/** Home → New Policy → New → Policy Start (new window) → Path ID + product → Next. */
export async function startNewPolicy(driver: WebDriver, pathId: string, productCode: string) {
  // Quirk: after a policy window was closed, New Policy in the same Home
  // window stopped opening the dialog. A fresh AQS login fixed it. If this
  // step times out, log out/in and rerun.
  await actionOpensWindow(driver, () => click(driver, L('home.newPolicy')));
  await click(driver, L('newPolicyType.new'));
  await actionOpensWindow(driver, () => click(driver, L('newPolicyType.ok')), 60_000);
  await driver.manage().window().maximize();

  await type(driver, L('policyStart.pathId'), pathId); // blur fills company, dates, etc.
  await driver.wait(
    async () => (await visible(driver, L('policyStart.productCode'))).isEnabled(),
    DEFAULT_TIMEOUT,
    'Product Code did not become enabled after Path ID',
  );
  await chooseCombo(driver, L('policyStart.productCode'), productCode);
  await click(driver, L('policyStart.next'));
  await waitForReady(driver, 60_000);
}

export interface InsuredAddress {
  name: string;
  street1: string;
  city: string;
  state: string; // two-letter code as shown in the State list, e.g. "PA"
  zip: string;
}

/** Fills Policy Information. Quirk: changing Policy Type pops an "edit PMA Description" message. */
export async function fillPolicyInformation(
  driver: WebDriver,
  opts: {
    policyType: string;
    pmaDescription: string;
    businessType: string;
    profession: string;
    primaryState?: string; // full name, e.g. "Pennsylvania"
    insured: InsuredAddress;
  },
) {
  await selectByText(driver, L('policyInfo.policyType'), opts.policyType);
  await handleAppMessage(driver, 'ok'); // "Policy type has changed. PMA Description may need to be edited."
  await selectByText(driver, L('policyInfo.pmaDescription'), opts.pmaDescription);
  await selectByText(driver, L('policyInfo.businessType'), opts.businessType);
  await selectByText(driver, L('policyInfo.namedInsuredProfession'), opts.profession);
  if (opts.primaryState) await chooseCombo(driver, L('policyInfo.primaryState'), opts.primaryState);

  // Quirk: the Path ID prefills a CA insured address; overwrite it so the
  // location and rating state agree.
  await click(driver, L('policyInfo.tab.insuredDetail'));
  await type(driver, L('insured.primaryName'), opts.insured.name);
  await type(driver, L('insured.street1'), opts.insured.street1);
  await type(driver, L('insured.city'), opts.insured.city);
  await selectByText(driver, L('insured.state'), opts.insured.state);
  await type(driver, L('insured.zip'), opts.insured.zip);
  await type(driver, L('insured.zipExt'), '');

  await click(driver, L('policyInfo.ok'));
  await waitForReady(driver, 60_000);
}

/**
 * Adds Location 1 / Building 1 from the named insured's address.
 * Quirk: rating fails with "Location Address State does not match policy
 * rating State" without a location in the rating state.
 * Quirk: Bld # stays disabled until focus leaves the address block.
 */
export async function addLocationFromInsured(driver: WebDriver) {
  await click(driver, L('tree.locationAddresses'));
  await waitForReady(driver);
  await click(driver, L('location.add'));
  await waitForReady(driver);
  await click(driver, L('location.useNamedInsured'));
  await selectByText(driver, L('location.locNumber'), '1');
  await driver.wait(async () => (await visible(driver, L('location.bldNumber'))).isEnabled(), 10_000);
  await selectByText(driver, L('location.bldNumber'), '1');
  await click(driver, L('location.ok'));
  await waitForReady(driver);
  await click(driver, L('locationSummary.ok'));
  await waitForReady(driver);
}

/**
 * Clicks Rate and returns rating errors, if any. The result window is titled
 * "Errors for Policy - ..."; it also appears with only warnings.
 */
export async function rate(driver: WebDriver): Promise<{ errors: string[]; warnings: string[] }> {
  const policyWindow = await driver.getWindowHandle();
  await click(driver, L('toolbar.rate'));
  const result = { errors: [] as string[], warnings: [] as string[] };
  try {
    await switchToWindowTitled(driver, /^Errors for Policy/, 60_000);
  } catch {
    await driver.switchTo().window(policyWindow);
    return result; // no messages at all
  }
  const body = await (await driver.findElement(By.css('body'))).getText();
  const [errPart, warnPart] = body.split(/WARNINGS/);
  if (/ERRORS/.test(errPart)) result.errors = linesAfter(errPart, 'ERRORS');
  if (warnPart) result.warnings = linesAfter(warnPart, '');
  await click(driver, L('errors.done'));
  await driver.switchTo().window(policyWindow);
  await waitForReady(driver, 60_000);
  return result;
}

function linesAfter(text: string, marker: string): string[] {
  const t = marker ? text.slice(text.indexOf(marker) + marker.length) : text;
  return t
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && !/^(COMMERCIAL AUTOMOBILE|CRIME|Done)$/i.test(s));
}

export async function moneyOf(driver: WebDriver, name: string): Promise<number> {
  const t = await (await visible(driver, L(name))).getText();
  return Number(t.replace(/[$,]/g, ''));
}

/**
 * Issue: Issue → confirm → Policy Numbering OK → Policy Documents (may show
 * "Entered Fields" dialogs and a "fields missing data" confirm) → Done →
 * Issue again → Policy Documents → Next → Issue Options OK.
 * Returns the issued policy number shown in Policy Numbering.
 */
export async function issue(driver: WebDriver): Promise<string> {
  await click(driver, L('header.issue'));
  const confirm = await handleAppMessage(driver, 'yes', 10_000);
  if (!confirm || !/issue this policy/i.test(confirm)) throw new Error(`unexpected issue confirm: ${confirm}`);

  const owner = await driver.getWindowHandle();
  await switchToWindowTitled(driver, /Policy Number Selection/, 60_000);
  const policyNumber = ((await (await visible(driver, L('policyNumbering.number'))).getAttribute('value')) ?? '').trim();
  await click(driver, L('policyNumbering.ok'));
  await driver.switchTo().window(owner);

  // Optional "Entered Fields" dialogs per document; accept with OK and continue past missing data.
  for (let i = 0; i < 10; i++) {
    try {
      await switchToWindowTitled(driver, /Entered Fields/, 8_000);
    } catch {
      break;
    }
    await click(driver, L('enteredFields.ok'));
    await handleAppMessage(driver, 'yes'); // "Some fields are missing data. Do you wish to continue?"
    await driver.switchTo().window(owner);
  }
  await click(driver, L('policyDocs.done'));
  await waitForReady(driver, 60_000);

  await click(driver, L('header.issue'));
  await waitForReady(driver, 60_000);
  await click(driver, L('policyDocs.next'));
  await waitForReady(driver, 60_000);
  await click(driver, L('issueOptions.ok'));
  await sleep(2_000); // policy window closes itself after issue
  return policyNumber;
}

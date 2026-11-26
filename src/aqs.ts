// Reusable steps for the legacy AQS UI in Edge IE mode.
// Everything here waits explicitly; nothing relies on sleeps except the short
// poll intervals inside waits.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { By, Key, WebDriver, WebElement, until } from 'selenium-webdriver';

export const DEFAULT_TIMEOUT = 30_000;

// ---------- page / window handling ----------

export async function waitForReady(driver: WebDriver, timeout = DEFAULT_TIMEOUT) {
  await driver.wait(
    async () => (await driver.executeScript('return document.readyState')) === 'complete',
    timeout,
    'page did not reach readyState=complete',
  );
}

/** Runs `action`, then waits for a window handle that did not exist before and switches to it. */
export async function actionOpensWindow(
  driver: WebDriver,
  action: () => Promise<void>,
  timeout = DEFAULT_TIMEOUT,
): Promise<string> {
  const before = new Set(await driver.getAllWindowHandles());
  await action();
  let found: string | undefined;
  await driver.wait(
    async () => {
      const now = await driver.getAllWindowHandles();
      found = now.find((h) => !before.has(h));
      return !!found;
    },
    timeout,
    'expected a new window/dialog to open',
  );
  await driver.switchTo().window(found!);
  await waitForReady(driver, timeout).catch(() => undefined); // modal dialogs may not report readyState
  return found!;
}

/** Switches to the first window whose title matches. AQS titles look like "AQS/advantage - Policy - <number> - ...". */
export async function switchToWindowTitled(driver: WebDriver, re: RegExp, timeout = DEFAULT_TIMEOUT) {
  let match: string | undefined;
  await driver.wait(
    async () => {
      for (const h of await driver.getAllWindowHandles()) {
        await driver.switchTo().window(h);
        if (re.test(await driver.getTitle())) {
          match = h;
          return true;
        }
      }
      return false;
    },
    timeout,
    `no window with title ${re}`,
  );
  return match!;
}

/** AQS shows JS alerts ("No matches found", confirmations). Accepts one if present. */
export async function acceptAlertIfPresent(driver: WebDriver, timeout = 2_000): Promise<string | undefined> {
  try {
    await driver.wait(until.alertIsPresent(), timeout);
    const alert = await driver.switchTo().alert();
    const text = await alert.getText();
    await alert.accept();
    return text;
  } catch {
    return undefined;
  }
}

// ---------- elements ----------

export async function visible(driver: WebDriver, by: By, timeout = DEFAULT_TIMEOUT): Promise<WebElement> {
  const el = await driver.wait(until.elementLocated(by), timeout, `not found: ${by}`);
  await driver.wait(until.elementIsVisible(el), timeout, `not visible: ${by}`);
  return el;
}

export async function click(driver: WebDriver, by: By, timeout = DEFAULT_TIMEOUT) {
  const el = await visible(driver, by, timeout);
  await driver.wait(until.elementIsEnabled(el), timeout, `disabled: ${by}`);
  await el.click();
}

/** Clears and types, then TABs out: AQS fires server round-trips on blur (e.g. Path ID fills the form). */
export async function type(driver: WebDriver, by: By, text: string) {
  const el = await visible(driver, by);
  await el.clear();
  await el.sendKeys(text, Key.TAB);
}

export async function valueOf(driver: WebDriver, by: By): Promise<string> {
  return (await (await visible(driver, by)).getAttribute('value')) ?? '';
}

/** Native <select>: picks the option by visible text and verifies the result. */
export async function selectByText(driver: WebDriver, by: By, text: string) {
  const sel = await visible(driver, by);
  const option = await sel.findElement(By.xpath(`.//option[normalize-space(.)=${xpathLiteral(text)}]`));
  await option.click();
  await driver.wait(
    async () => (await sel.getAttribute('value')) === (await option.getAttribute('value')),
    5_000,
    `select ${by} did not take "${text}"`,
  );
  // Fire onchange explicitly; IE-mode option clicks don't always trigger it.
  await driver.executeScript(
    // Old IE document modes (AQS) have fireEvent but no createEvent.
    'var el=arguments[0];if(el.fireEvent){el.fireEvent("onchange");}else{var e=document.createEvent("HTMLEvents");e.initEvent("change",true,false);el.dispatchEvent(e);}',
    sel,
  );
}

export async function setCheckbox(driver: WebDriver, by: By, checked: boolean) {
  const el = await visible(driver, by);
  if ((await el.isSelected()) !== checked) await el.click();
  await driver.wait(async () => (await el.isSelected()) === checked, 5_000, `checkbox ${by} state`);
}

export function xpathLiteral(s: string): string {
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"')) return `"${s}"`;
  return `concat('${s.split("'").join(`', "'", '`)}')`;
}

// ---------- downloads (TestHarness returns the policy as a file) ----------

export const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR ?? path.join(os.homedir(), 'Downloads');

export function snapshotDownloads(): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of fs.readdirSync(DOWNLOAD_DIR)) {
    m.set(f, fs.statSync(path.join(DOWNLOAD_DIR, f)).mtimeMs);
  }
  return m;
}

/** Waits for a file matching `re` that is new or modified since `before`, and fully written. */
export async function waitForDownload(
  before: Map<string, number>,
  re: RegExp,
  timeout = 60_000,
): Promise<string> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const f of fs.readdirSync(DOWNLOAD_DIR)) {
      if (!re.test(f) || f.endsWith('.crdownload') || f.endsWith('.partial')) continue;
      const full = path.join(DOWNLOAD_DIR, f);
      const mtime = fs.statSync(full).mtimeMs;
      if (before.get(f) === mtime) continue;
      const size1 = fs.statSync(full).size;
      await sleep(500);
      if (size1 > 0 && fs.statSync(full).size === size1) return full;
    }
    await sleep(500);
  }
  throw new Error(`no new download matching ${re} in ${DOWNLOAD_DIR} within ${timeout} ms`);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

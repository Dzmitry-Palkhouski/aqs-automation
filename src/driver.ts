// Creates a Selenium session in Microsoft Edge IE mode (IEDriverServer).
// If TestFrameworkSelenium already has a driver factory for IE mode, use that
// instead and delete this file: only `createDriver()` is imported elsewhere.
//
// Prerequisites on the VM (standard for IE-mode Selenium):
//   - IEDriverServer.exe (32-bit recommended) on PATH, or IE_DRIVER_PATH set
//   - Browser zoom 100%
//   - Same Protected Mode setting for all Internet Options zones
import { Builder, WebDriver } from 'selenium-webdriver';
import * as ie from 'selenium-webdriver/ie';
import { aqsStartUrl } from './local';

const EDGE_PATH =
  process.env.EDGE_PATH ??
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

/**
 * `initialUrl` is where the browser starts. It MUST be on the target site:
 * IEDriver starts on a localhost page and, when the first navigation crosses
 * into another security zone (localhost → corp site), loses the browser
 * ("Unable to get browser", 0 windows). Seen on the VM on 2026-11-26.
 */
export async function createDriver(initialUrl?: string): Promise<WebDriver> {
  const options = new ie.Options()
    .initialBrowserUrl(initialUrl ?? process.env.IE_INITIAL_URL ?? aqsStartUrl())
    .setEdgeChromium(true)
    .setEdgePath(EDGE_PATH)
    .ignoreZoomSetting(true)
    .introduceFlakinessByIgnoringProtectedModeSettings(true)
    .ensureCleanSession(false); // keep cookies so an existing SSO/login can be reused

  const builder = new Builder().forBrowser('internet explorer').setIeOptions(options);
  if (process.env.IE_DRIVER_PATH) {
    builder.setIeService(new ie.ServiceBuilder(process.env.IE_DRIVER_PATH));
  }
  const driver = await builder.build();
  await driver.manage().setTimeouts({ implicit: 0, pageLoad: 120_000, script: 60_000 });
  return driver;
}

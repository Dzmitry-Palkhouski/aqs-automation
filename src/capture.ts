// Locator capture for the legacy AQS / TestHarness UI in Edge IE mode.
//
// Opens an IE-mode browser driven by Selenium. Navigate by hand (or by screen
// control) in THAT browser window. The console is driven by single keys only,
// digits and Enter, because letters do not pass reliably through the Horizon
// remote desktop:
//
//   Enter  snapshot ALL open windows/dialogs/frames to captures/<run>/
//   1      toggle locator labels drawn over the current window (id / name / #n)
//   2      list open windows (marks the one Selenium is attached to with *)
//   3      attach Selenium to the next window in the list
//   4      attach Selenium to the newest window (just-opened popup/dialog)
//   5      print the controls of the current window to the console
//   6      snapshot only the current window
//   7 n Enter  click control #n through Selenium (any other key cancels)
//   0      quit (browser stays open)
//
// Files per document:
//   <NN>_<title>_<handle>[_frame-x-y].html   raw page source
//   <NN>_<title>_<handle>[_frame-x-y].json   controls (id, name, label, options...)
//
// Usage:  npx ts-node src/capture.ts [startUrl]
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { By, WebDriver, WebElement } from 'selenium-webdriver';
import { createDriver } from './driver';
import { aqsStartUrl } from './local';

const START_URL = process.argv[2] ?? aqsStartUrl();
const CALL_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// In-page scripts. ES3 only: AQS pages run in old IE document modes (quirks /
// IE5-7) where querySelectorAll, JSON, Array#indexOf, String#trim and
// addEventListener do not exist (seen on the VM on 2026-11-26).

// Shared helpers. gather() lists interactive elements in document order; its
// index n is the same in the controls list and in the overlay labels.
const PAGE_HELPERS = `
var TAGS = { INPUT: 1, SELECT: 1, TEXTAREA: 1, BUTTON: 1, A: 1 };
// Old IE throws on some property reads ("Invalid procedure call or
// argument"); every read goes through these.
function g(o, k) { try { var v = o[k]; return v == null ? '' : v; } catch (e) { return ''; } }
function ga(el, name) {
  try { var v = el.getAttribute ? el.getAttribute(name) : null; return v == null ? '' : String(v); } catch (e) { return ''; }
}
function gather() {
  var all = document.getElementsByTagName('*');
  var res = [];
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    if (el.className === '__cap_ov') continue;
    var tag = g(el, 'tagName');
    var oc = ga(el, 'onclick');
    if (TAGS[tag] || (oc && oc.length > 0)) res[res.length] = el;
  }
  return res;
}
function clean(s) { return String(s || '').replace(/\\s+/g, ' ').replace(/^ +| +$/g, ''); }
function cut(s, n) { s = String(s || ''); return s.length > n ? s.substring(0, n) : s; }
function q(s) {
  return '"' + String(s).replace(/\\\\/g, '\\\\\\\\').replace(/"/g, '\\\\"')
    .replace(/[\\u0000-\\u001f]/g, ' ') + '"';
}
function rect(el) {
  try { var r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; } catch (e) { return null; }
}
`;

// Returns a JSON string (built by hand: no JSON object in old modes).
const COLLECT_CONTROLS = `${PAGE_HELPERS}
function labelFor(el) {
  if (el.id) {
    var labels = document.getElementsByTagName('label');
    for (var k = 0; k < labels.length; k++) {
      if (labels[k].htmlFor === el.id) return clean(labels[k].innerText);
    }
  }
  var td = el.parentNode;
  while (td && td.tagName && td.tagName !== 'TD' && td.tagName !== 'TH') td = td.parentNode;
  if (td) {
    var p = td.previousSibling;
    while (p && p.nodeType !== 1) p = p.previousSibling;
    if (p) return clean(p.innerText || p.textContent);
  }
  return '';
}
var nodes = gather();
var parts = [];
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  try {
    var tag = String(g(el, 'tagName'));
    var r = rect(el);
    var vis = !!r && (r.right - r.left) > 0 && (r.bottom - r.top) > 0;
    var opts = [];
    if (tag === 'SELECT') {
      var os = g(el, 'options');
      for (var j = 0; os && j < os.length && j < 200; j++) {
        opts[opts.length] = '{"value":' + q(g(os[j], 'value')) + ',"text":' + q(g(os[j], 'text')) + '}';
      }
    }
    var type = String(g(el, 'type'));
    var v = type === 'password' ? '***' : g(el, 'value');
    var lbl = '';
    try { lbl = labelFor(el); } catch (e) {}
    parts[parts.length] = '{"n":' + i +
      ',"tag":' + q(tag.toLowerCase()) +
      ',"type":' + q(type) +
      ',"id":' + q(g(el, 'id')) +
      ',"name":' + q(g(el, 'name')) +
      ',"value":' + q(cut(v, 80)) +
      ',"checked":' + (g(el, 'checked') ? 'true' : 'false') +
      ',"disabled":' + (g(el, 'disabled') ? 'true' : 'false') +
      ',"visible":' + (vis ? 'true' : 'false') +
      ',"text":' + q(cut(clean(g(el, 'innerText') || g(el, 'textContent') || g(el, 'alt') || g(el, 'title')), 80)) +
      ',"label":' + q(cut(lbl, 80)) +
      ',"onclick":' + q(cut(ga(el, 'onclick'), 160)) +
      ',"href":' + q(tag === 'A' ? cut(ga(el, 'href'), 160) : '') +
      ',"options":[' + opts.join(',') + ']}';
  } catch (e) {
    parts[parts.length] = '{"n":' + i + ',"tag":"?","type":"","id":"","name":"","value":"","checked":false,"disabled":false,"visible":false,"text":' +
      q('error: ' + (e && e.message)) + ',"label":"","onclick":"","href":"","options":[]}';
  }
}
return '{"url":' + q(g(document.location, 'href')) + ',"title":' + q(g(document, 'title')) +
  ',"docMode":' + q(g(document, 'documentMode') || g(document, 'compatMode')) +
  ',"controls":[' + parts.join(',') + ']}';
`;

// Toggles small yellow labels above every visible control: "#n id" or
// "#n @name". Returns the number of labels drawn (0 when removed).
const TOGGLE_OVERLAY = `${PAGE_HELPERS}
var BASE = arguments[0] || 0;
var divs = document.getElementsByTagName('div');
var old = [];
for (var k = 0; k < divs.length; k++) if (divs[k].className === '__cap_ov') old[old.length] = divs[k];
if (old.length) {
  for (var m = 0; m < old.length; m++) old[m].parentNode.removeChild(old[m]);
  return '0,' + gather().length;
}
var body = document.body;
if (!body) return '0,' + gather().length;
var de = document.documentElement;
var sx = (de && de.scrollLeft) || body.scrollLeft || 0;
var sy = (de && de.scrollTop) || body.scrollTop || 0;
var nodes = gather();
var drawn = 0;
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  var r = rect(el);
  if (!r || (r.right - r.left) <= 0 || (r.bottom - r.top) <= 0) continue;
  var eid = g(el, 'id'), ename = g(el, 'name');
  var key = eid ? eid : (ename ? '@' + ename : '');
  var d = document.createElement('div');
  d.className = '__cap_ov';
  d.appendChild(document.createTextNode('#' + (BASE + i) + (key ? ' ' + key : '')));
  var s = d.style;
  s.position = 'absolute';
  s.left = (r.left + sx) + 'px';
  s.top = (r.top + sy - 11 < 0 ? 0 : r.top + sy - 11) + 'px';
  s.backgroundColor = '#ffeb3b';
  s.color = '#000000';
  s.fontFamily = 'Arial';
  s.fontSize = '9px';
  s.lineHeight = '10px';
  s.padding = '0px 1px';
  s.border = '1px solid #cc0000';
  s.zIndex = '32000';
  s.whiteSpace = 'nowrap';
  try { s.pointerEvents = 'none'; } catch (e) {}
  try { body.appendChild(d); drawn++; } catch (e) {}
}
return drawn + ',' + nodes.length;
`;

// Returns the element with local index arguments[0] (same order as gather()).
const GET_ELEMENT = `${PAGE_HELPERS}
return gather()[arguments[0]];
`;

// ---------------------------------------------------------------------------

interface Control {
  n: number;
  tag: string;
  type: string;
  id: string;
  name: string;
  value: string;
  disabled: boolean;
  visible: boolean;
  text: string;
  label: string;
}

// A window that owns an open modal dialog can block script calls; don't let
// one stuck window freeze the session.
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what}: no answer in ${ms} ms`)), ms)),
  ]);
}

function safe(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'untitled';
}

async function forEachFrame(
  driver: WebDriver,
  fn: (framePath: number[]) => Promise<void>,
  framePath: number[] = [],
): Promise<void> {
  await fn(framePath);
  const frames = await withTimeout(driver.findElements(By.css('frame,iframe')), CALL_TIMEOUT, 'find frames').catch(
    () => [],
  );
  for (let i = 0; i < frames.length; i++) {
    try {
      await driver.switchTo().frame(i);
      await forEachFrame(driver, fn, [...framePath, i]);
    } catch (e) {
      console.log(`  ! frame ${[...framePath, i].join('-')}: ${(e as Error).message}`);
    } finally {
      await driver.switchTo().parentFrame().catch(() => undefined);
    }
  }
}

class Capture {
  private seq = 1;
  constructor(
    private driver: WebDriver,
    private dir: string,
  ) {}

  async current(): Promise<string | undefined> {
    return withTimeout(this.driver.getWindowHandle(), CALL_TIMEOUT, 'current window').catch(() => undefined);
  }

  async listWindows(): Promise<string[]> {
    const handles = await this.driver.getAllWindowHandles();
    const cur = await this.current();
    console.log(`  ${handles.length} window(s):`);
    for (let i = 0; i < handles.length; i++) {
      const h = handles[i];
      let title = '?';
      try {
        await this.driver.switchTo().window(h);
        title = await withTimeout(this.driver.getTitle(), 5_000, 'title');
      } catch (e) {
        title = `(${(e as Error).message})`;
      }
      console.log(`  ${h === cur ? '*' : ' '} [${i}] ${title}`);
    }
    if (cur) await this.driver.switchTo().window(cur).catch(() => undefined);
    return handles;
  }

  async attach(index: 'next' | 'newest') {
    const handles = await this.driver.getAllWindowHandles();
    const cur = await this.current();
    const i = index === 'newest' ? handles.length - 1 : (Math.max(0, handles.indexOf(cur ?? '')) + 1) % handles.length;
    await this.driver.switchTo().window(handles[i]);
    const title = await withTimeout(this.driver.getTitle(), 5_000, 'title').catch(() => '?');
    console.log(`  attached to [${i}] ${title}`);
  }

  // Numbers are global across frames (document order, top first), so the
  // label "#n" on screen is what clickNumber(n) clicks.
  async toggleOverlay() {
    let total = 0;
    let base = 0;
    await forEachFrame(this.driver, async (fp) => {
      try {
        const res = String(await withTimeout(this.driver.executeScript(TOGGLE_OVERLAY, base), CALL_TIMEOUT, 'overlay'));
        const [drawn, count] = res.split(',').map(Number);
        if (drawn > 0) total += drawn;
        if (fp.length && drawn > 0) console.log(`  frame ${fp.join('-')}: #${base}..#${base + count - 1}`);
        base += count || 0;
      } catch (e) {
        console.log(`  ! overlay ${fp.join('-') || 'top'}: ${(e as Error).message}`);
      }
    });
    console.log(total ? `  labels ON (${total})` : '  labels OFF');
  }

  async printControls() {
    let base = 0;
    await forEachFrame(this.driver, async (fp) => {
      try {
        const json = (await withTimeout(this.driver.executeScript(COLLECT_CONTROLS), CALL_TIMEOUT, 'controls')) as string;
        const { title, controls } = JSON.parse(json) as { title: string; controls: Control[] };
        const shown = controls.filter((c) => c.visible).map((c) => ({ ...c, n: c.n + base }));
        base += controls.length;
        console.log(`  ${title}${fp.length ? ` [frame ${fp.join('-')}]` : ''}: ${shown.length} visible controls`);
        for (const c of shown) {
          const key = c.id ? `#${c.id}` : c.name ? `@${c.name}` : '-';
          const what = c.label || c.text || c.value;
          console.log(`   ${String(c.n).padStart(3)} ${c.tag}${c.type ? ':' + c.type : ''} ${key} ${what ? '"' + what + '"' : ''}${c.disabled ? ' (disabled)' : ''}`);
        }
      } catch (e) {
        console.log(`  ! ${(e as Error).message}`);
      }
    });
  }

  /**
   * Clicks control #n through Selenium (native click), so IEDriver itself
   * sees any window or modal dialog the click opens. Then lists windows.
   */
  async clickNumber(n: number) {
    let base = 0;
    let done = false;
    await forEachFrame(this.driver, async (fp) => {
      if (done) return;
      try {
        const count = Number(
          await withTimeout(this.driver.executeScript(`${PAGE_HELPERS} return gather().length;`), CALL_TIMEOUT, 'count'),
        );
        if (n >= base && n < base + count) {
          const el = (await withTimeout(this.driver.executeScript(GET_ELEMENT, n - base), CALL_TIMEOUT, 'element')) as WebElement;
          const desc = await withTimeout(
            this.driver.executeScript(
              `var e=arguments[0];return e.tagName+' id='+(e.id||'')+' name='+(e.name||'')+' text='+String(e.innerText||e.value||e.alt||'').substring(0,40);`,
              el,
            ),
            CALL_TIMEOUT,
            'describe',
          );
          console.log(`  clicking #${n}${fp.length ? ` [frame ${fp.join('-')}]` : ''}: ${desc}`);
          await withTimeout(el.click(), 30_000, 'click');
          done = true;
        }
        base += count;
      } catch (e) {
        console.log(`  ! click #${n}: ${(e as Error).message}`);
        done = true;
      }
    });
    if (!done) console.log(`  #${n} not found (max #${base - 1})`);
    await new Promise((r) => setTimeout(r, 2_000));
    await this.listWindows();
  }

  private async snapshotCurrent(seq: number): Promise<number> {
    const h = (await this.current()) ?? 'unknown';
    const title = await withTimeout(this.driver.getTitle(), 5_000, 'title').catch(() => '');
    const prefix = `${String(seq).padStart(2, '0')}_${safe(title)}_${h.slice(-6)}`;
    let written = 0;
    let controls = 0;
    await forEachFrame(this.driver, async (fp) => {
      const suffix = fp.length ? `_frame-${fp.join('-')}` : '';
      try {
        const html = await withTimeout(this.driver.getPageSource(), CALL_TIMEOUT, 'page source');
        const json = (await withTimeout(this.driver.executeScript(COLLECT_CONTROLS), CALL_TIMEOUT, 'controls')) as string;
        const parsed = JSON.parse(json);
        fs.writeFileSync(path.join(this.dir, `${prefix}${suffix}.html`), html, 'utf8');
        fs.writeFileSync(
          path.join(this.dir, `${prefix}${suffix}.json`),
          JSON.stringify({ windowHandle: h, framePath: fp, ...parsed }, null, 2),
          'utf8',
        );
        written++;
        controls += parsed.controls.length;
      } catch (e) {
        console.log(`  ! ${title || h} ${suffix}: ${(e as Error).message}`);
      }
    });
    console.log(`  #${seq} "${title}": ${written} doc(s), ${controls} controls`);
    return written;
  }

  async snapshot(all: boolean) {
    const seq = this.seq++;
    const original = await this.current();
    if (!all) {
      await this.snapshotCurrent(seq);
      return;
    }
    for (const h of await this.driver.getAllWindowHandles()) {
      try {
        await this.driver.switchTo().window(h);
        await this.snapshotCurrent(seq);
      } catch (e) {
        console.log(`  ! window ${h.slice(-6)}: ${(e as Error).message}`);
      }
    }
    if (original) await this.driver.switchTo().window(original).catch(() => undefined);
  }
}

const HELP =
  'Enter=snapshot all  1=labels  2=windows  3=next window  4=newest window  5=list controls  6=snapshot current  7<n>Enter=click #n  0=quit';

async function main() {
  const run = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(process.cwd(), 'captures', run);
  fs.mkdirSync(dir, { recursive: true });

  const driver = await createDriver(START_URL); // start in the target zone; see driver.ts
  const cap = new Capture(driver, dir);
  console.log(`Browser opened at ${START_URL}`);
  console.log(`Snapshots: ${dir}`);
  console.log(HELP);

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  let busy = false;
  let clickDigits: string | null = null; // non-null while typing "7<n>Enter"
  process.stdin.on('keypress', async (_str: string, key: { name?: string; sequence?: string; ctrl?: boolean }) => {
    if (key.ctrl && key.name === 'c') process.exit(0);
    if (clickDigits !== null) {
      const isEnter = key.name === 'return' || key.name === 'enter';
      if (key.sequence && /^[0-9]$/.test(key.sequence)) {
        clickDigits += key.sequence;
        process.stdout.write(key.sequence);
        return;
      }
      const digits = clickDigits;
      clickDigits = null;
      if (!isEnter || digits === '') {
        console.log('\n  click cancelled');
        return;
      }
      console.log('');
      busy = true;
      try {
        await cap.clickNumber(Number(digits));
      } catch (e) {
        console.log(`  ! ${(e as Error).message}`);
      } finally {
        busy = false;
      }
      return;
    }
    if (busy) {
      console.log('  (busy, wait)');
      return;
    }
    busy = true;
    try {
      switch (key.name === 'return' || key.name === 'enter' ? 'enter' : key.sequence) {
        case 'enter':
          console.log('> snapshot all');
          await cap.snapshot(true);
          break;
        case '1':
          console.log('> labels');
          await cap.toggleOverlay();
          break;
        case '2':
          console.log('> windows');
          await cap.listWindows();
          break;
        case '3':
          console.log('> next window');
          await cap.attach('next');
          break;
        case '4':
          console.log('> newest window');
          await cap.attach('newest');
          break;
        case '5':
          console.log('> controls');
          await cap.printControls();
          break;
        case '6':
          console.log('> snapshot current');
          await cap.snapshot(false);
          break;
        case '7':
          clickDigits = '';
          process.stdout.write('> click #');
          break;
        case '0':
          console.log(`Done. Snapshots in ${dir}. Browser left open.`);
          process.exit(0);
        default:
          console.log(HELP);
      }
    } catch (e) {
      console.log(`  ! ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

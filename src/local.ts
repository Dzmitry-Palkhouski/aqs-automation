// Environment-specific values (internal host, test policy numbers) are kept out
// of the repository. They come from environment variables or from
// aqs.local.json in the project root (git-ignored). See aqs.local.example.json.
import * as fs from 'fs';
import * as path from 'path';

interface LocalConfig {
  aqsBaseUrl?: string;
  retrievalPolicyNumber?: string;
  retrievalExpectedPolicyId?: string;
}

const FILE = path.resolve(__dirname, '..', 'aqs.local.json');
// Shortcut for the VM, where typing is slow: a one-line file with just the
// host name, e.g. created with `sc aqs.host aqs.example.com`.
const HOST_FILE = path.resolve(__dirname, '..', 'aqs.host');

function load(): LocalConfig {
  if (fs.existsSync(FILE)) {
    return JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, '')) as LocalConfig;
  }
  if (fs.existsSync(HOST_FILE)) {
    const host = fs.readFileSync(HOST_FILE, 'utf8').replace(/^﻿/, '').replace(/\u0000/g, '').trim();
    if (host) return { aqsBaseUrl: /^https?:\/\//.test(host) ? host : `https://${host}` };
  }
  return {};
}

export const LOCAL = load();

/** Base URL of the AQS host, e.g. https://aqs.example.com (no trailing slash). */
export function aqsBaseUrl(): string {
  const url = process.env.AQS_BASE_URL ?? LOCAL.aqsBaseUrl;
  if (!url) {
    throw new Error(`AQS host is not set: create ${FILE} from aqs.local.example.json or set AQS_BASE_URL`);
  }
  return url.replace(/\/+$/, '');
}

export const aqsStartUrl = () =>
  process.env.AQS_START_URL ?? `${aqsBaseUrl()}/aqs.advantage.client/default.aspx`;

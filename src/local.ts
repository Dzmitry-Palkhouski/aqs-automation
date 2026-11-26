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

function load(): LocalConfig {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE, 'utf8').replace(/^﻿/, '')) as LocalConfig;
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

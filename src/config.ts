// All test data in one place; override via environment variables or aqs.local.json.
import { LOCAL, aqsBaseUrl, aqsStartUrl } from './local';

export const CONFIG = {
  get aqsStartUrl() {
    return aqsStartUrl();
  },
  get harnessRetrievalUrl() {
    return process.env.HARNESS_RETRIEVAL_URL ?? `${aqsBaseUrl()}/AQS.PolicyAdministrationTest/PolicyRetrieval`;
  },

  retrieval: {
    policyNumber: process.env.RETRIEVAL_POLICY_NUMBER ?? LOCAL.retrievalPolicyNumber ?? '',
    expectedPolicyId: process.env.RETRIEVAL_EXPECTED_POLICY_ID ?? LOCAL.retrievalExpectedPolicyId ?? '',
  },

  // Path ID must be unused. Default: derived from time, so each run gets a
  // fresh number. Override to pin a value.
  newPathId: process.env.NEW_PATH_ID ?? freshPathId(),

  // Run at most this far. "rate" leaves a quote; "issue" issues the policy.
  stopAfter: (process.env.STOP_AFTER ?? 'rate') as 'rate' | 'issue',
};

function freshPathId(): string {
  // 8 digits: 9 + last 7 digits of epoch seconds. Unique per ~115 days per second.
  return '9' + String(Math.floor(Date.now() / 1000)).slice(-7);
}

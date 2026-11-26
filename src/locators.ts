// Locators, filled in from the capture run (captures/<run>/*.json).
// Every entry starts as TODO; `L(name)` throws a clear error until it is set,
// so a test fails at the first uncaptured element instead of clicking blindly.
//
// Prefer By.id / By.name from the capture JSON. Fall back to XPath on the
// visible label only when the element has neither.
import { By } from 'selenium-webdriver';

type Locators = Record<string, By | undefined>;

const TODO = undefined;

export const LOCATORS: Locators = {
  // ---- TestHarness: Policy Retrieval Service (/AQS.PolicyAdministrationTest/PolicyRetrieval)
  'retrieval.requestType.rest': TODO,
  'retrieval.requestType.soap': TODO,
  'retrieval.policyId': TODO,
  'retrieval.policyNumber': TODO, // previously seen as #Request_PolicyNumber, verify
  'retrieval.transactional': TODO,
  'retrieval.smartCommFilter': TODO,
  'retrieval.outputFormat': TODO,
  'retrieval.execute': TODO,

  // ---- TestHarness LogOn (/AQS.PolicyAdministrationTest/Account/LogOn)
  'harnessLogin.user': TODO,
  'harnessLogin.password': TODO,
  'harnessLogin.submit': TODO,

  // ---- AQS start page / login popup
  'start.policyAdministration': TODO,
  'login.user': TODO,
  'login.password': TODO,
  'login.ok': TODO,

  // ---- AQS Home window
  'home.newPolicy': TODO,
  'home.allPolicies': TODO,
  'allPolicies.policyNumber': TODO,
  'allPolicies.retrieve': TODO,
  'allPolicies.firstRow': TODO,
  'allPolicies.view': TODO,
  'newPolicyType.new': TODO,
  'newPolicyType.ok': TODO,

  // ---- Policy window: Policy Start
  'policyStart.pathId': TODO,
  'policyStart.productCode': TODO,
  'policyStart.next': TODO,

  // ---- Policy Information (modal form with tabs)
  'policyInfo.policyType': TODO,
  'policyInfo.pmaDescription': TODO,
  'policyInfo.businessType': TODO,
  'policyInfo.namedInsuredProfession': TODO,
  'policyInfo.primaryState': TODO,
  'policyInfo.tab.insuredDetail': TODO,
  'insured.primaryName': TODO,
  'insured.street1': TODO,
  'insured.city': TODO,
  'insured.state': TODO,
  'insured.zip': TODO,
  'insured.zipExt': TODO,
  'policyInfo.ok': TODO,

  // ---- Tree / toolbar inside the policy window
  'tree.locationAddresses': TODO,
  'tree.lobActionMenu': TODO,
  'tree.commercialAuto': TODO,
  'toolbar.rate': TODO,
  'toolbar.worksheets': TODO,
  'header.issue': TODO,
  'header.status': TODO, // "In Process Quote" / "Approved Quote"

  // ---- Location Address
  'location.add': TODO,
  'location.useNamedInsured': TODO,
  'location.locNumber': TODO,
  'location.bldNumber': TODO,
  'location.ok': TODO,
  'locationSummary.ok': TODO,

  // ---- LOB Action Menu
  'lob.row.crime': TODO,
  'lob.row.commercialAuto': TODO,
  'lob.add': TODO,
  'lob.premium.crime': TODO,
  'lob.premium.commercialAuto': TODO,
  'lob.total': TODO,

  // ---- Crime
  'crime.policy.next': TODO,
  'crime.state.addClass': TODO,
  'crimeClass.search': TODO,
  'crimeClass.firstRow': TODO,
  'crimeClass.select': TODO,
  'crimeClass.ok': TODO,
  'crime.state.next': TODO,
  'unitCov.available.employeeTheft': TODO,
  'unitCov.select': TODO,
  'employeeTheft.limit': TODO,
  'employeeTheft.ratableEmployees': TODO,
  'employeeTheft.ok': TODO,
  'unitCov.done': TODO,

  // ---- Commercial Auto
  'cau.policy.classifiedAs': TODO,
  'cau.policy.next': TODO,
  'cau.state.umLimit': TODO,
  'cau.state.uimLimit': TODO,
  'cau.state.next': TODO,
  'cau.vehicleLimits.next': TODO,
  'cau.commonCov.next': TODO,
  'cau.vehicles.add': TODO,
  'vehicle.type': TODO,
  'vehicle.next': TODO,
  'vehicle.vin': TODO,
  'vehicle.modelYear': TODO,
  'vehicle.manufacturer': TODO,
  'vehicle.costNew': TODO,
  'vehicle.class': TODO,
  'vehicle.ok': TODO,
  'firstParty.type': TODO,
  'firstParty.ok': TODO,
  'vehicleCov.ok': TODO,
  'vehicles.done': TODO,
  'cauMenu.symbols': TODO,
  'cauMenu.vehicleSummary': TODO,
  'vehicles.firstRow': TODO,
  'vehicles.coverages': TODO,
  'vehicleCov.selected.liability': TODO,
  'vehicleCov.ratesFactors': TODO,
  'ratesFactors.cancel': TODO,
  'symbols.ok': TODO,
  // symbol checkboxes are generated per coverage; see symbolCheckbox() in the OCP test

  // ---- "Application Message -- Webpage Dialog" (AQS modal, not a JS alert)
  'appMessage.text': TODO,
  'appMessage.ok': TODO,
  'appMessage.yes': TODO,

  // ---- Rating errors window ("Errors for Policy - ...")
  'errors.done': TODO,

  // ---- Issue flow
  'policyNumbering.number': TODO,
  'policyNumbering.ok': TODO,
  'enteredFields.ok': TODO,
  'policyDocs.next': TODO,
  'policyDocs.done': TODO,
  'issueOptions.ok': TODO,
};

export function L(name: string): By {
  const by = LOCATORS[name];
  if (!by) throw new Error(`Locator "${name}" not captured yet: fill it in src/locators.ts`);
  return by;
}

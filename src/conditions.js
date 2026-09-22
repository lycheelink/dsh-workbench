/**
 * Shared conditional-field evaluation and required-field validation.
 * Pure (no Node/browser deps) so the host bundle (src/index.js) and the
 * browser bundle (src/client/*) consume the SAME logic — one source of truth
 * for the condition grammar instead of three drifting copies.
 */

/** Supported condition grammar: `key == 'literal'` (string equality). */
const CONDITION_RE = /^(\w+)\s*==\s*'([^']*)'$/;

/**
 * Evaluate `"key == 'value'"` against a form-data record.
 * Unsupported operators or malformed expressions resolve to `false`.
 */
export function evaluateCondition(expression, formData) {
  const match = String(expression ?? "").trim().match(CONDITION_RE);
  if (match === null) return false;
  const [, key, value] = match;
  return String(formData[key] ?? "") === value;
}

/** A field is missing when it is undefined, null, or an empty string. */
function isMissing(value) {
  return value === undefined || value === null || value === "";
}

/**
 * Collect the keys of required fields that are unsatisfied: the card's basic
 * formSchema plus whichever conditional groups are currently active.
 * @param {object} card - workbench card with `formSchema` / `conditionalFields`.
 * @param {Record<string, unknown>} formData - submitted values.
 * @returns {string[]} missing required keys (basic + active conditional).
 */
export function missingRequiredFields(card, formData) {
  const missing = [];
  for (const field of card.formSchema ?? []) {
    if (field.required && isMissing(formData[field.key])) missing.push(field.key);
  }
  for (const group of card.conditionalFields ?? []) {
    if (!evaluateCondition(group.when, formData)) continue;
    for (const field of group.fields ?? []) {
      if (field.required && isMissing(formData[field.key])) missing.push(field.key);
    }
  }
  return missing;
}

/**
 * The conditional groups whose `when` predicate currently holds.
 * @param {object} card - workbench card with `conditionalFields`.
 * @param {Record<string, unknown>} formData - submitted values.
 * @returns {object[]} active conditional groups.
 */
export function activeConditionalGroups(card, formData) {
  const active = [];
  for (const group of card.conditionalFields ?? []) {
    if (evaluateCondition(group.when, formData)) active.push(group);
  }
  return active;
}

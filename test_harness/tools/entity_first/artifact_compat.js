'use strict';
/**
 * artifact_compat.js -- may THIS consumer read THAT published artifact? (T177, P-SYSTEM-VERSIONS, R-INVARIANT-FROZEN)
 *
 * Three version meanings stay distinct (the Charter forbids collapsing them into one counter):
 *   source-schema version  the shape of the AUTHORED source          ($source.source_schema_version)
 *   derivation version     the shape of the GENERATED artifact       ($source.derivation_version)
 *   interface version      what a CONSUMING module may rely on       (interface_version)
 * A consumer states which of each it accepts (schema/btnyc-interface-contract.json). check() refuses a published artifact outside that, and says which meaning disagrees and what to do.
 *
 * This file depends on nothing: it is the piece a runtime module would load and run before it reads any index, so it must not need the derivation, the validator or the source. The runtime does not
 * call it yet (wiring it into startup is runtime work this migration does not do; PENDING_DECISIONS #218). publish.js calls it, so an artifact no consumer could accept is never published.
 */
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const parse = v => { const m = typeof v === 'string' && SEMVER.exec(v); return m ? [+m[1], +m[2], +m[3]] : null; };

// contract: { interface_version: "1.0.0", accepts: { source_schema_versions: [...], derivation_versions: [...] }, required_indexes: [...] }
// The interface rule: the major version must be equal (a major change breaks a consumer); the artifact's minor version must be at least the contract's (it may only have ADDED indexes).
function check(artifact, contract) {
  const problems = [];
  const say = (kind, msg) => problems.push({ kind, msg });
  if (!artifact || typeof artifact !== 'object') return { ok: false, problems: [{ kind: 'artifact', msg: 'the artifact is not an object' }] };
  const src = artifact.$source;
  if (!src || typeof src !== 'object') say('provenance', 'the artifact carries no $source (a derived artifact says which source and which derivation produced it); it is not a published artifact');
  else {
    for (const k of ['path', 'sha256', 'source_schema_version', 'derivation_version']) if (typeof src[k] !== 'string' || !src[k]) say('provenance', `$source.${k} is missing`);
    if (typeof src.source_schema_version === 'string' && !contract.accepts.source_schema_versions.includes(src.source_schema_version)) say('source_schema_version', `the artifact was derived from source schema ${src.source_schema_version}; this consumer accepts ${contract.accepts.source_schema_versions.join(', ')}. Re-derive from a source at an accepted schema, or move the consumer.`);
    if (typeof src.derivation_version === 'string' && !contract.accepts.derivation_versions.includes(src.derivation_version)) say('derivation_version', `the artifact has derivation version ${src.derivation_version}; this consumer accepts ${contract.accepts.derivation_versions.join(', ')}. Re-publish with an accepted derivation.`);
  }
  const have = parse(artifact.interface_version), want = parse(contract.interface_version);
  if (!have) say('interface_version', `interface_version ${JSON.stringify(artifact.interface_version)} is not a semantic version`);
  else if (!want) say('interface_version', 'the consumer contract has no valid interface_version');
  else if (have[0] !== want[0]) say('interface_version', `the artifact's interface is ${artifact.interface_version}; this consumer is built for ${contract.interface_version}. A different major version is a breaking change: publish and deploy together, or version-gate the consumer.`);
  else if (have[1] < want[1]) say('interface_version', `the artifact's interface ${artifact.interface_version} is older than the ${contract.interface_version} this consumer needs (an index it reads may be missing)`);
  for (const idx of contract.required_indexes || []) if (!Object.prototype.hasOwnProperty.call(artifact, idx)) say('required_index', `the artifact holds no ${idx} index, which this consumer reads`);
  return { ok: problems.length === 0, problems };
}
// the one-line refusal a startup check would print
function refusal(result) { return result.ok ? null : 'artifact refused: ' + result.problems.map(p => `[${p.kind}] ${p.msg}`).join(' | '); }

module.exports = { check, refusal, parse };

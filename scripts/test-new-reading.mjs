import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";

// Content validation only: this script does not create an attempt or a band score.
const reading = JSON.parse(await readFile(new URL("../app/data/reading.json", import.meta.url), "utf8"));
const targetId = "gt-original-diagnostic-02";
const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const clean = value => String(value).normalize("NFC").trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
const words = value => String(value).trim().split(/\s+/).filter(Boolean);
const literalContains = (source, value) => new RegExp("(?<![\\p{L}\\p{N}])" + clean(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}\\p{N}])", "u").test(clean(source));
const paragraphs = test => test.sections.flatMap(section => section.texts.flatMap(text => text.paragraphs));

// Baseline captured before adding this test. Preserve old content, keys and IDs.
const oldTestIds = ["gt-original-diagnostic-01"];
const oldDrillIds = ["original-drill-views-headings", "original-drill-features-endings", "original-drill-completion", "original-drill-diagram", "original-drill-short-answers"];
const oldTests = reading.tests.filter(test => oldTestIds.includes(test.id));
const oldDrills = reading.drills.filter(test => oldDrillIds.includes(test.id));
assert.equal(oldTests.length, oldTestIds.length, "A previous test was removed");
assert.equal(oldDrills.length, oldDrillIds.length, "A previous drill was removed");
assert.equal(hash(oldTests), "bb73bf71e479a1ac3d66145d0112dfb5fca0cf27a3d533dc3b5d13b6de6c24ec", "Previous test content/keys changed");
assert.equal(hash(oldDrills), "42ac40cabb60597ccc94ef661a00521be2f539e90c49653f462b42fed695383e", "Previous drills changed");
assert.equal(hash(reading.sources), "14d6ad0a8988cf1bb1776f96447f113bcdf46fd5e7d7577821ce5c62fd40a75b", "Existing source list changed");
const resources = [...reading.tests, ...reading.drills];
assert.equal(new Set(resources.map(resource => resource.id)).size, resources.length, "Duplicate resource IDs");
const test = reading.tests.find(test => test.id === targetId);
assert(test, "New test missing");
assert.equal(hash(test), "2ae4a982342a9eb671762b51c42fede59d00682ac7c319854541038132cbd3e6", "Reserved full diagnostic 02 changed while adding targeted drills");
assert.equal(test.kind, "original");
assert.equal(test.minutes, 60);
assert.equal(test.sections.length, 3);
assert.deepEqual(test.sections.map(section => section.texts.length), [2, 2, 1]);
const wordCounts = test.sections.map(section => section.texts.reduce((sum, text) => sum + text.paragraphs.reduce((n, paragraph) => n + words(paragraph.replace(/^[A-G]\.\s+/, "")).length, 0), 0));
const totalWords = wordCounts.reduce((a, b) => a + b, 0);
assert(totalWords >= 2150 && totalWords <= 2375, `GT text length outside official range: ${totalWords}`);
for (const section of test.sections) {
  assert(section.title.trim());
  for (const text of section.texts) {
    assert(text.title.trim() && text.paragraphs.length >= 3);
    assert(text.paragraphs.every(paragraph => typeof paragraph === "string" && paragraph.trim()));
  }
}
assert.equal(test.questions.length, 40);
assert.deepEqual(test.questions.map(question => question.id), Array.from({length: 40}, (_, i) => String(i + 1)));
assert.equal(new Set(test.questions.map(question => clean(question.prompt))).size, 40, "Duplicate prompts");
assert.deepEqual(test.sections.map((_, section) => test.questions.filter(question => question.section === section).length), [14, 13, 13]);
const supported = new Set(["choice", "completion", "matching", "tfng", "ynng"]);
const numericAliases = {two: "2"};
const keyLabel = value => clean(value).split(".")[0];
for (const question of test.questions) {
  const context = `${targetId} Q${question.id}`;
  assert(supported.has(question.type), `${context}: unsupported type`);
  assert(Number.isInteger(question.section) && question.section >= 0 && question.section < 3, `${context}: invalid section`);
  for (const field of ["instruction", "prompt", "answer", "evidence", "explanation"]) assert(typeof question[field] === "string" && question[field].trim(), `${context}: missing ${field}`);
  assert(Array.isArray(question.accepted) && question.accepted.length, `${context}: accepted missing`);
  assert(question.accepted.every(answer => typeof answer === "string" && answer.trim()), `${context}: empty accepted variant`);
  assert.equal(new Set(question.accepted.map(clean)).size, question.accepted.length, `${context}: duplicate variants`);
  assert(question.accepted.map(clean).includes(clean(question.answer)), `${context}: canonical key is not accepted`);
  const ref = question.evidenceRef;
  assert(ref && ref.section === question.section && Number.isInteger(ref.text) && Number.isInteger(ref.paragraph), `${context}: invalid evidence reference`);
  const paragraph = test.sections[ref.section]?.texts[ref.text]?.paragraphs[ref.paragraph];
  assert(paragraph && paragraph.includes(question.evidence), `${context}: evidence is not an exact extract from its paragraph`);
  if (question.type === "completion") {
    assert(!question.options, `${context}: unexpected options`);
    const max = /NO MORE THAN TWO WORDS/.test(question.instruction) ? 2 : /ONE WORD/.test(question.instruction) ? 1 : 0;
    assert(max, `${context}: explicit word limit missing`);
    for (const answer of question.accepted) {
      assert(words(answer).length <= max, `${context}: accepted variant exceeds word limit`);
      assert(!/\d/.test(answer) || /NUMBER/.test(question.instruction), `${context}: numeric answer not permitted`);
      const literal = literalContains(paragraph, answer);
      const equivalentNumber = /NUMBER/.test(question.instruction) && (numericAliases[clean(answer)] === clean(question.answer));
      assert(literal || equivalentNumber, `${context}: accepted answer not extractable from the text`);
    }
  } else {
    assert(Array.isArray(question.options) && question.options.length >= 3, `${context}: options missing`);
    assert.equal(new Set(question.options.map(clean)).size, question.options.length, `${context}: duplicate options`);
    assert(question.options.map(clean).includes(clean(question.answer)), `${context}: key not in options`);
    for (const answer of question.accepted) assert(clean(answer) === clean(question.answer) || clean(answer) === keyLabel(question.answer), `${context}: accepted variant selects another option`);
  }
  if (question.type === "choice") {
    assert.equal(question.options.length, 4, `${context}: this test uses four-option single-choice questions`);
    assert.equal(question.accepted.length, 2, `${context}: accept letter and displayed option`);
  }
  if (question.type === "tfng") assert.deepEqual(question.options, ["TRUE", "FALSE", "NOT GIVEN"]);
  if (question.type === "ynng") assert.deepEqual(question.options, ["YES", "NO", "NOT GIVEN"]);
}
for (const [type, labels] of [["tfng", ["TRUE", "FALSE", "NOT GIVEN"]], ["ynng", ["YES", "NO", "NOT GIVEN"]]]) {
  assert.deepEqual([...new Set(test.questions.filter(question => question.type === type).map(question => question.answer))].sort(), labels.sort(), `${type}: missing a decision category`);
}
for (const ids of [[22, 23, 24], [28, 29, 30, 31]]) {
  const group = ids.map(id => test.questions[id - 1]);
  assert.equal(new Set(group.map(question => question.answer)).size, ids.length, "Repeated ending/heading key");
  assert(group.every(question => JSON.stringify(question.options) === JSON.stringify(group[0].options)), "Group options differ");
  assert(group[0].options.length > group.length, "No surplus endings/headings");
}
assert(test.questions.slice(27, 31).every(question => /No heading may be used more than once/.test(question.instruction)));
assert(test.questions.slice(31, 33).every(question => /may use any letter more than once/i.test(question.instruction)));

// Check for material copied verbatim from the retained bank; semantic novelty is reviewed separately.
const tokens = value => clean(value).replace(/[^a-z0-9' -]/g, " ").split(/\s+/).filter(Boolean);
const ngrams = value => { const list = tokens(value); return list.slice(0, Math.max(0, list.length - 11)).map((_, i) => list.slice(i, i + 12).join(" ")); };
const legacyPhrases = new Set([...oldTests, ...oldDrills].flatMap(resource => paragraphs(resource).flatMap(ngrams)));
for (const paragraph of paragraphs(test)) for (const phrase of ngrams(paragraph)) assert(!legacyPhrases.has(phrase), "A 12-word phrase was recycled from the old bank");
const targetedIds = ["original-drill-tfng-cycle-parking", "original-drill-tfng-proof-requests"];
const occupiedPhrases = new Set([...legacyPhrases, ...paragraphs(test).flatMap(ngrams)]);
for (const id of targetedIds) {
  const drill = reading.drills.find(resource => resource.id === id);
  assert(drill, `${id}: missing`);
  assert.equal(drill.kind, "original");
  assert.equal(drill.minutes, 10);
  assert.equal(drill.sections.length, 1);
  assert.equal(drill.sections[0].texts.length, 1);
  const count = words(paragraphs(drill).join(" ")).length;
  assert(count >= 180 && count <= 250, `${id}: expected 180–250 words, found ${count}`);
  assert.deepEqual(drill.questions.map(question => question.id), ["1", "2", "3", "4"]);
  assert.equal(new Set(drill.questions.map(question => clean(question.prompt))).size, 4);
  const decisions = drill.questions.filter(question => question.type === "tfng");
  assert.equal(decisions.length, 3);
  assert.deepEqual(decisions.map(question => question.answer).sort(), ["FALSE", "NOT GIVEN", "TRUE"]);
  assert.equal(drill.questions.filter(question => question.type === "completion").length, 1);
  for (const question of drill.questions) {
    const context = `${id} Q${question.id}`;
    assert.equal(question.section, 0);
    assert(question.prompt.trim() && question.instruction.trim() && question.explanation.trim(), `${context}: missing content`);
    assert(Array.isArray(question.accepted) && question.accepted.length && question.accepted.map(clean).includes(clean(question.answer)), `${context}: invalid accepted key`);
    assert.equal(new Set(question.accepted.map(clean)).size, question.accepted.length, `${context}: duplicate accepted variants`);
    const ref = question.evidenceRef;
    assert(ref && ref.section === 0 && ref.text === 0 && Number.isInteger(ref.paragraph), `${context}: invalid reference`);
    const paragraph = drill.sections[0].texts[0].paragraphs[ref.paragraph];
    assert(paragraph && paragraph.includes(question.evidence), `${context}: nonliteral evidence`);
    if (question.type === "tfng") {
      assert.deepEqual(question.options, ["TRUE", "FALSE", "NOT GIVEN"]);
      assert(question.accepted.every(answer => answer === question.answer), `${context}: inconsistent label variant`);
      assert(/TRUE.*FALSE.*NOT GIVEN/.test(question.instruction));
    } else {
      const max = /NO MORE THAN TWO WORDS/.test(question.instruction) ? 2 : /ONE WORD/.test(question.instruction) ? 1 : 0;
      assert(max && !question.options, `${context}: response limit missing`);
      assert(question.accepted.every(answer => words(answer).length <= max && literalContains(paragraph, answer)), `${context}: answer exceeds limit or is not extractable`);
    }
  }
  assert(!Object.keys(drill).some(key => /band|calibrat|official|conversion/i.test(key)));
  for (const paragraph of paragraphs(drill)) for (const phrase of ngrams(paragraph)) assert(!occupiedPhrases.has(phrase), `${id}: recycled 12-word phrase`);
  for (const phrase of paragraphs(drill).flatMap(ngrams)) occupiedPhrases.add(phrase);
  console.log(`PASS ${id}: ${count} words; 10 min; 3 TFNG decision categories + 1 answer-limit question`);
}
// There is no calibration or raw-to-band table attached to this original resource.
assert(!Object.keys(test).some(key => /band|calibrat|official|conversion/i.test(key)), "Original test claims a score conversion");
const types = test.questions.reduce((counts, question) => ({...counts, [question.type]: (counts[question.type] || 0) + 1}), {});
console.log(`PASS ${targetId}: 40 unique questions; 60 min; 2+2+1 texts; ${totalWords} words (${wordCounts.join("/")})`);
console.log(`PASS keys, accepted variants, limits, exact evidence references, task groups and decision categories: ${JSON.stringify(types)}`);
console.log("PASS retained test/drills/source hashes unchanged; no recycled 12-word passages; original resource has no band conversion");
console.log("LIMIT: these checks do not calibrate difficulty, validate every semantic judgment, or prove a reader has not seen the material.");

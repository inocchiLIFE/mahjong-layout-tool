import assert from 'node:assert/strict'
import { classifyIishantenCandidate, createCompleteFollow, generateIishanten, generateIishantenQuestion, generateRandomIishanten, hasLegalTileCounts, verifyIishantenCandidate } from '../.tmp-iishanten-test/iishanten.js'

for (const type of ['surplus', 'complete', 'headless1', 'headless2', 'kuttsuki']) {
  for (let index = 0; index < 10; index += 1) {
    const hand = generateIishanten(type)
    assert.equal(hand.length, 13, `${type}: 13 tiles`)
    assert.ok(hasLegalTileCounts(hand), `${type}: max four copies`)
    assert.ok(verifyIishantenCandidate(type, hand), `${type}: decomposition`)
  }
}

for (let index = 0; index < 20; index += 1) {
  const random = generateRandomIishanten()
  assert.equal(random.tileIds.length, 13, 'random iishanten has 13 tiles')
  assert.ok(verifyIishantenCandidate(random.type, random.tileIds), 'random iishanten preserves its generated type')

  const question = generateIishantenQuestion()
  assert.equal(question.tileIds.length, 14, 'what-to-discard question has 14 tiles')
  assert.equal(question.tileIds.at(-1), question.drawnTileId, 'drawn tile stays at the far right')
  assert.ok(question.tileIds.every((tile) => {
    const base = tile.replace('aka-', '')
    return question.tileIds.filter((candidate) => candidate.replace('aka-', '') === base).length <= 4
  }), 'what-to-discard question never has five copies')
  assert.ok(verifyIishantenCandidate(question.type, question.tileIds.slice(0, 13)), 'question begins with a valid iishanten shape')
}
assert.equal(hasLegalTileCounts(['man1', 'man1', 'man1', 'man1', 'man1']), false, 'five identical tiles are invalid')
assert.equal(verifyIishantenCandidate('headless2', ['man1', 'man1', 'man1', 'man2', 'man2', 'man2', 'man3', 'man3', 'man3', 'pin1', 'pin2', 'pin3', 'ton']), false, 'headless2 must have two taatsu')
assert.equal(verifyIishantenCandidate('headless1', ['man1', 'man3', 'pin2', 'pin3', 'pin4', 'sou1', 'sou2', 'sou3', 'sou4', 'sou5', 'sou6', 'sou7', 'sou8']), false, 'headless1 must reject a hand that has two taatsu after taking three melds')
assert.equal(verifyIishantenCandidate('headless1', ['man3', 'pin3', 'pin4', 'pin5', 'pin6', 'pin7', 'pin8', 'pin8', 'pin8', 'sou3', 'sou4', 'sou4', 'sou4']), false, 'headless1 must reject a hand with a head after taking three melds')
assert.equal(verifyIishantenCandidate('headless2', ['man1', 'man1', 'man1', 'man2', 'man2', 'man2', 'man3', 'man3', 'man3', 'pin3', 'pin3', 'pin4', 'pin4']), false, 'headless2 must reject a hand with a possible head after taking three melds')
assert.equal(verifyIishantenCandidate('surplus', ['man2', 'man3', 'man4', 'man5', 'man6', 'man7', 'man7', 'pin3', 'pin5', 'pin5', 'pin5', 'pin7', 'pin8']), false, 'surplus must reject a hand with three melds')
assert.equal(verifyIishantenCandidate('surplus', ['man1', 'man1', 'man6', 'man6', 'man6', 'man7', 'man7', 'man8', 'pin3', 'pin5', 'sou5', 'sou6', 'sou7']), false, 'surplus must reject a vertically supported taatsu')
assert.equal(
  classifyIishantenCandidate(['man3', 'pin3', 'pin4', 'pin5', 'pin6', 'pin7', 'pin8', 'pin8', 'pin8', 'sou3', 'sou4', 'sou4', 'sou4']),
  'kuttsuki',
  'a shape with three melds and a head is classified as kuttsuki instead of headless1',
)
assert.equal(
  classifyIishantenCandidate(['man1', 'man3', 'pin2', 'pin3', 'pin4', 'sou1', 'sou2', 'sou3', 'sou4', 'sou5', 'sou6', 'sou7', 'sou8']),
  'headless2',
  'a shape with three melds and two taatsu is classified as headless2 instead of headless1',
)
assert.equal(
  classifyIishantenCandidate(['man2', 'man3', 'man4', 'man7', 'man8', 'man9', 'pin3', 'pin3', 'pin5', 'pin6', 'sou4', 'sou4', 'sou9']),
  'surplus',
  'a second pair can be treated as taatsu while the other pair is the head',
)

for (let index = 0; index < 20; index += 1) {
  const vertical = createCompleteFollow('vertical')
  assert.equal(vertical.length, 3, 'vertical follow has three tiles')
  assert.ok(new Set(vertical).size < 3, 'vertical follow duplicates a taatsu tile')

  const kanchan = createCompleteFollow('kanchan').map((tile) => Number(tile.at(-1))).sort((a, b) => a - b)
  assert.equal(kanchan.length, 3, 'kanchan follow has three tiles')
  assert.ok(
    (kanchan[2] - kanchan[0] === 4) || new Set(kanchan).size < 3,
    'kanchan follow is either an outside ryan-kan or a vertical support',
  )
}
console.log('iishanten generation tests passed')

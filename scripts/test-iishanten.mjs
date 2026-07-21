import assert from 'node:assert/strict'
import { generateIishanten, hasLegalTileCounts, verifyIishantenCandidate } from '../.tmp-iishanten-test/iishanten.js'

for (const type of ['surplus', 'complete', 'headless1', 'headless2', 'kuttsuki']) {
  for (let index = 0; index < 10; index += 1) {
    const hand = generateIishanten(type)
    assert.equal(hand.length, 13, `${type}: 13 tiles`)
    assert.ok(hasLegalTileCounts(hand), `${type}: max four copies`)
    assert.ok(verifyIishantenCandidate(type, hand), `${type}: decomposition`)
  }
}
assert.equal(hasLegalTileCounts(['man1', 'man1', 'man1', 'man1', 'man1']), false, 'five identical tiles are invalid')
assert.equal(verifyIishantenCandidate('headless2', ['man1', 'man1', 'man1', 'man2', 'man2', 'man2', 'man3', 'man3', 'man3', 'pin1', 'pin2', 'pin3', 'ton']), false, 'headless2 must have two taatsu')
assert.equal(verifyIishantenCandidate('surplus', ['man2', 'man3', 'man4', 'man5', 'man6', 'man7', 'man7', 'pin3', 'pin5', 'pin5', 'pin5', 'pin7', 'pin8']), false, 'surplus must reject a hand with three melds')
console.log('iishanten generation tests passed')

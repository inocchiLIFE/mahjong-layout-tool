import assert from 'node:assert/strict'
import { getEfficiency } from '../.tmp-efficiency-test/mahjongEfficiency.js'

// m123 is an open chi. The concealed 45s wait can win on 3s or 6s, but the
// visible 3s in the chi must reduce that wait from four copies to three.
const concealedHand = ['man4', 'man5', 'man6', 'man7', 'man8', 'man9', 'pin2', 'pin2', 'sou4', 'sou5']
const openMeld = ['sou1', 'sou2', 'sou3']
const withoutMeldTiles = getEfficiency(concealedHand, 1)
const withMeldTiles = getEfficiency(concealedHand, 1, openMeld)

assert.equal(withoutMeldTiles?.shanten, 0, 'fixture is tenpai with one open meld')
assert.equal(withMeldTiles?.shanten, 0, 'open meld does not change shanten count')
assert.deepEqual(withMeldTiles?.effectiveTileIds, ['sou3', 'sou6'], 'the same winning tiles remain available')
assert.equal(withoutMeldTiles?.effectiveTileCount, 8, 'both waits have four copies before known tiles are applied')
assert.equal(withMeldTiles?.effectiveTileCount, 7, 'the visible 3s in the open meld is subtracted from remaining waits')

const fourOpenMeldTiles = [
  'man1', 'man1', 'man1',
  'pin5', 'pin5', 'pin5', 'pin5',
  'sou7', 'sou7', 'sou7',
  'haku', 'haku', 'haku',
]
const fourOpenMeldHand = getEfficiency(['ton'], 4, fourOpenMeldTiles)
assert.equal(fourOpenMeldHand?.shanten, 0, 'a four-open-meld hand with one concealed tile is correctly treated as tenpai')
assert.deepEqual(fourOpenMeldHand?.effectiveTileIds, ['ton'], 'the remaining concealed tile determines the pair wait')
assert.equal(fourOpenMeldHand?.effectiveTileCount, 3, 'the one selected honor is subtracted from the four possible copies')

const invalidAcrossHandAndMeld = getEfficiency(['man1', 'man1'], 1, ['man1', 'man1', 'man1'])
assert.equal(invalidAcrossHandAndMeld, null, 'five copies across the concealed hand and an open meld are rejected')

console.log('efficiency known-tile tests passed')

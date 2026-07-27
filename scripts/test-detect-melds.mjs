import assert from 'node:assert/strict'
import { detectOpenMelds } from '../.tmp-detect-melds-test/detectMelds.js'

const tile = (id, tileId, x, rotation = 0, y = 0) => ({ id, tileId, x, y, rotation, selected: true, zIndex: x, locked: false, kind: 'tile', faceDown: false })

const chi = detectOpenMelds([tile('a', 'man1', 0), tile('b', 'man2', 48, 90), tile('c', 'man3', 96)])
assert.equal(chi.length, 1, 'sideways sequence is detected')
assert.equal(chi[0].kind, 'open-sequence')
assert.deepEqual(chi[0].tileIds, ['man1', 'man2', 'man3'])

const calledMiddle = detectOpenMelds([tile('a', 'sou1', 0), tile('b', 'sou3', 48, 90), tile('c', 'sou2', 96)])
assert.equal(calledMiddle[0].kind, 'open-sequence', 'a chi is detected even when its called tile is in the middle of the displayed order')

const kan = detectOpenMelds([tile('a', 'haku', 0, 90), tile('b', 'haku', 48), tile('c', 'haku', 96), tile('d', 'haku', 144)])
assert.equal(kan[0].kind, 'open-kan', 'four identical tiles with a call marker are detected as an open kan')

const upright = detectOpenMelds([tile('a', 'man1', 0), tile('b', 'man2', 48), tile('c', 'man3', 96)])
assert.equal(upright.length, 0, 'upright concealed tiles are not treated as an open meld')

const separated = detectOpenMelds([tile('a', 'man1', 0, 90), tile('b', 'man2', 160), tile('c', 'man3', 208)])
assert.equal(separated.length, 0, 'separated tiles are not treated as one meld')

const snappedChi = detectOpenMelds([tile('a', 'pin3', 0, 90, 32), tile('b', 'pin4', 66, 0), tile('c', 'pin5', 132, 0)])
assert.equal(snappedChi[0].kind, 'open-sequence', 'a lower, rotated tile in a snapped meld layout is detected')

const spacedChi = detectOpenMelds([tile('a', 'sou4', 0), tile('b', 'sou5', 96, 90), tile('c', 'sou6', 192)])
assert.equal(spacedChi.length, 1, 'a one-tile gap inside an open meld is detected')
assert.equal(spacedChi[0].kind, 'open-sequence')

const trailingOpenChi = detectOpenMelds([
  tile('s4', 'sou4', 0), tile('s5', 'sou5', 48), tile('s6', 'sou6', 96),
  tile('s7', 'sou7', 144, 90), tile('s8', 'sou8', 210), tile('s9', 'sou9', 258),
])
assert.equal(trailingOpenChi.length, 1, 'only the intended open block is selected from a continuous row')
assert.deepEqual(trailingOpenChi[0].tileIds, ['sou7', 'sou8', 'sou9'], 'a sideways 7 starts the open 789 block instead of selecting 567')

const fourOpenMelds = detectOpenMelds([
  tile('a1', 'man1', 0), tile('a2', 'man1', 48, 90), tile('a3', 'man1', 96),
  tile('b1', 'pin5', 180, 90), tile('b2', 'pin5', 228), tile('b3', 'pin5', 276), tile('b4', 'pin5', 324),
  tile('c1', 'sou7', 420), tile('c2', 'sou7', 468, 90), tile('c3', 'sou7', 516),
  tile('d1', 'haku', 620), tile('d2', 'haku', 668, 90), tile('d3', 'haku', 716),
])
assert.equal(fourOpenMelds.length, 4, 'four open melds are all detected together')
assert.deepEqual([...fourOpenMelds.map((meld) => meld.kind)].sort(), ['open-kan', 'open-triplet', 'open-triplet', 'open-triplet'])

console.log('meld detection tests passed')

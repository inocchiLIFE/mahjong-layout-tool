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

console.log('meld detection tests passed')

import assert from 'node:assert/strict'
import { calculateExpectedValues, scoreWinningHand } from '../.tmp-expected-value-test/expectedValue.js'

const hand = ['man1', 'man2', 'man3', 'man6', 'pin1', 'pin2', 'pin3', 'pin5', 'pin5', 'sou1', 'sou2', 'sou3', 'sou7', 'sou8']
const settings = { roundWind: 'ton', seatWind: 'ton', turn: 1, doraIndicator: null, visibleCounts: {}, includeRedDora: true, includeUraDora: false, allowShantenBack: true, allowHandChange: true }
const early = calculateExpectedValues(hand, settings, 8)
assert.ok(early.length > 0, '14 tiles produce discard candidates')
assert.ok(early.every((item) => item.expectedPoints >= 0 && item.winProbability >= 0 && item.winProbability <= 1), 'probabilities and expected points are bounded')

const late = calculateExpectedValues(hand, { ...settings, turn: 18 }, 8)
assert.ok(late[0].winProbability <= early[0].winProbability, 'fewer remaining turns cannot improve the best win probability')

const blocked = calculateExpectedValues(hand, { ...settings, visibleCounts: { sou6: 4, sou9: 4 } }, 8)
assert.ok(blocked[0].effectiveTileCount <= early[0].effectiveTileCount, 'visible tiles reduce remaining acceptance')

const scoreSettings = { roundWind: 'ton', seatWind: 'nan', doraIndicator: null, includeRedDora: true, includeUraDora: false, riichi: true }
const pinfu = scoreWinningHand(
  ['man2', 'man3', 'man4', 'man3', 'man4', 'man5', 'pin3', 'pin4', 'pin5', 'sou6', 'sou7', 'sou8', 'pin6', 'pin6'],
  'man2',
  scoreSettings,
)
assert.equal(pinfu?.fu, 20, 'closed pinfu tsumo is 20 fu')
assert.equal(pinfu?.points, 5200, 'non-dealer 4 han 20 fu tsumo totals 5200 points')
assert.ok(pinfu?.yaku.includes('平和'), 'pinfu is detected')

const pinfuWithDora = scoreWinningHand(
  ['man2', 'man3', 'man4', 'man3', 'man4', 'man5', 'pin3', 'pin4', 'pin5', 'sou6', 'sou7', 'sou8', 'pin6', 'pin6'],
  'man2',
  { ...scoreSettings, doraIndicator: 'pin4' },
)
assert.equal(pinfuWithDora?.points, 8000, 'one dora raises 4 han 20 fu to mangan')

const sevenPairs = scoreWinningHand(
  ['man1', 'man1', 'man3', 'man3', 'man5', 'man5', 'man7', 'man7', 'pin2', 'pin2', 'pin4', 'pin4', 'pin6', 'pin6'],
  'pin6',
  { ...scoreSettings, riichi: false },
)
assert.equal(sevenPairs?.fu, 25, 'seven pairs is fixed at 25 fu')
assert.ok(sevenPairs?.yaku.includes('七対子'), 'seven pairs is detected')

const kokushi = scoreWinningHand(
  ['man1', 'man9', 'pin1', 'pin9', 'sou1', 'sou9', 'ton', 'nan', 'sha', 'pei', 'haku', 'hatsu', 'chun', 'ton'],
  'ton',
  scoreSettings,
)
assert.equal(kokushi?.yakuman, 1, 'thirteen orphans is a yakuman')
assert.ok(kokushi?.yaku.includes('国士無双'), 'thirteen orphans is detected')
console.log('expected value tests passed')

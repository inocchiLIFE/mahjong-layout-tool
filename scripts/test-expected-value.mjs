import assert from 'node:assert/strict'
import { calculateExpectedValues, scoreWinningHand } from '../.tmp-expected-value-test/expectedValue.js'

const hand = ['man1', 'man2', 'man3', 'man6', 'pin1', 'pin2', 'pin3', 'pin5', 'pin5', 'sou1', 'sou2', 'sou3', 'sou7', 'sou8']
const settings = { roundWind: 'ton', seatWind: 'ton', turn: 1, doraIndicator: null, visibleCounts: {}, includeRedDora: true, includeUraDora: false, allowShantenBack: false, allowHandChange: false }
const early = calculateExpectedValues(hand, settings)
assert.ok(early.length > 0, '14 tiles produce discard candidates')
assert.ok(early.every((item) => item.expectedPoints >= 0 && item.winProbability >= 0 && item.winProbability <= 1), 'probabilities and expected points are bounded')

const late = calculateExpectedValues(hand, { ...settings, turn: 18 })
assert.ok(late[0].winProbability <= early[0].winProbability, 'fewer remaining turns cannot improve the best win probability')

const blocked = calculateExpectedValues(hand, { ...settings, visibleCounts: { sou6: 4, sou9: 4 } })
assert.ok(blocked[0].effectiveTileCount <= early[0].effectiveTileCount, 'visible tiles reduce remaining acceptance')

// Source-site regression fixture (pystyle simulator 0.9.8 / mahjong-cpp).
// 3339m34678p44478s, East round, East seat, turn 3, East indicator.
const referenceHand = ['man3', 'man3', 'man3', 'man9', 'pin3', 'pin4', 'pin6', 'pin7', 'pin8', 'sou4', 'sou4', 'sou4', 'sou7', 'sou8']
const referenceSettings = {
  ...settings,
  turn: 3,
  doraIndicator: 'ton',
  includeUraDora: true,
  allowShantenBack: true,
  allowHandChange: true,
}
const referenceResult = calculateExpectedValues(referenceHand, referenceSettings)
const referenceFor = (tileId) => referenceResult.find((item) => item.discardTileId === tileId)
const assertNear = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`)

assert.equal(referenceResult[0].discardTileId, 'man9', 'source-site fixture selects 9m as the best discard')
assertNear(referenceFor('man9').expectedPoints, 4496, 20, '9m expected value matches source site')
assertNear(referenceFor('man9').winProbability, 0.5516, 0.002, '9m win probability matches source site')
assertNear(referenceFor('man9').tenpaiProbability, 0.9873, 0.002, '9m tenpai probability matches source site')
assertNear(referenceFor('sou8').expectedPoints, 4202, 60, '8s expected value matches source site')
assertNear(referenceFor('sou8').winProbability, 0.4962, 0.003, '8s win probability matches source site')
assertNear(referenceFor('man3').expectedPoints, 3232, 20, '3m expected value matches source site')

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

const openYakuhai = scoreWinningHand(
  ['pin4', 'pin5', 'pin6', 'pin7', 'pin8', 'pin9', 'sou3', 'sou4', 'sou5', 'man2', 'man2'],
  'sou5',
  { ...scoreSettings, riichi: false, melds: [{ id: 'open-haku', kind: 'open-triplet', tileIds: ['haku', 'haku', 'haku'] }] },
)
assert.ok(openYakuhai, 'an open hand with a yakuhai block is scored')
assert.ok(openYakuhai?.yaku.includes('役牌 白'), 'open yakuhai is detected')
assert.ok(!openYakuhai?.yaku.includes('門前清自摸和'), 'open hands do not receive menzen tsumo')

const mixedTriplets = scoreWinningHand(
  ['man1', 'man2', 'man3', 'pin4', 'pin4', 'pin4', 'sou2', 'sou2'],
  'pin4',
  {
    ...scoreSettings,
    riichi: false,
    melds: [
      { id: 'open-haku', kind: 'open-triplet', tileIds: ['haku', 'haku', 'haku'] },
      { id: 'open-hatsu', kind: 'open-triplet', tileIds: ['hatsu', 'hatsu', 'hatsu'] },
    ],
  },
)
assert.ok(mixedTriplets, 'a hand with open triplets is scored')
assert.ok(!mixedTriplets?.yaku.includes('三暗刻'), 'open triplets are not counted as concealed triplets')
console.log('expected value tests passed')

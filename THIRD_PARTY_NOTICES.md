# Third-Party Notices

## mahjong-cpp

- Project: [nekobean/mahjong-cpp](https://github.com/nekobean/mahjong-cpp)
- Copyright: © 2021–2026 nekobean
- License: GNU General Public License v3.0
- Referenced revision: `453cae05caf0e3c0da13846f82c20685becaea6e`
- Referenced files: `src/mahjong/core/expected_score_calculator.cpp`, `src/mahjong/core/expected_score_calculator.hpp`

The draw/discard hand graph and backward expected-score recurrence were ported
to TypeScript in `src/utils/expectedValue.ts`. The port integrates the browser
UI, the existing tile representation, and visible/red-tile settings. It was
modified on 2026-07-23.

## mahjong-win-prob

- Project: [tomohxx/mahjong-win-prob](https://github.com/tomohxx/mahjong-win-prob)
- Copyright: © 2022–2025 tomohxx
- License: GNU General Public License v3.0
- Referenced revision: `36ac07db113ef9bad146a1e336800e8e79a52916`
- Referenced files: `src/win_prob1.cpp`, `src/win_prob1.hpp`, `src/win_prob2.cpp`, `src/win_prob2.hpp`

This project is the algorithmic foundation cited by mahjong-cpp and was also
consulted while validating the TypeScript port.

The source project and this combined application are distributed under GNU
General Public License v3.0. See [LICENSE](LICENSE) for the complete license.

## Informational references

- [麻雀アルゴリズム](https://github.com/tomohxx/mahjong-algorithm-book): explanation of the hand-transition graph and dynamic programming formula.
- [麻雀何切るシミュレーター](https://pystyle.info/apps/mahjong-nanikiru-simulator/): source-site behavior used for regression fixtures and result comparison.

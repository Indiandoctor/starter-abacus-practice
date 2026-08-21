# Starter Abacus Sprint

Starter Abacus Sprint is a free, child-friendly browser game for practicing the speed and accuracy of beginner abacus calculations. Each seven-minute round contains up to 100 questions and supports fast keyboard play: type an answer, then press Enter.

This is an independent practice tool. It is not affiliated with or endorsed by UCMAS, ALOHA, SIP Abacus, or any other abacus organization.

## Arithmetic rules

- Every practice set contains exactly 100 unique questions.
- Every question has exactly four signed, nonzero, single-digit operands (`1` through `9` in magnitude).
- The first operand is always positive. Later positive operands display `+`; negative operands display `−`.
- Every intermediate running total and final answer is zero or greater.
- Addition and subtraction are mixed, including questions with one, two, and three subtractions where valid.
- At least 20 questions per set contain an opposite-sign cancellation pair such as `+3` and `−3`.
- Questions are generated and validated before the timer starts, then shuffled.

## Scoring

The round ends when 100 valid answers have been submitted or seven minutes elapse. “Submitted” counts every valid numeric response, whether correct or incorrect. Results show correct, incorrect, unanswered, accuracy, time used, average response time, and a combined competition result. Incorrectly answered questions can be reviewed after the round; unanswered questions are counted separately.

Best correct score, best accuracy (only for rounds with at least 10 attempts), most submitted, an optional player name, and up to 10 recent results are stored locally in the browser. No data is transmitted. Refreshing during an active round resets it; a stale timer is never restored.

## Run locally

The game has no dependencies or build step. Serve this folder with any static HTTP server, for example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000/`. Opening `index.html` directly also works in modern browsers, though an HTTP server is recommended for testing.

## GitHub Pages

This repository is designed to publish directly from the `main` branch and `/(root)` folder. The deployment package consists only of `index.html`, `game.css`, `game.js`, `.nojekyll`, and this README. GitHub Pages serves those files as-is; no GitHub Action, package install, API, subscription, or paid service is required.

## Privacy

There are no accounts, analytics, trackers, cookies, external assets, API calls, or downloaded dependencies. All optional progress data remains in the browser's `localStorage` until it is cleared by the player.

# Babel Markets eval harness

Phase 1 deliverable. Fixtures here are the smoke test for the agent loop.

Each fixture is a markdown file with frontmatter and a body:

```
---
source_lang: yo
expected_tradable: true
notes: Nigerian fuel subsidy story
---

(body text in the source language, typically a paragraph or two of news)
```

## Coverage

The Phase 1 set targets 30+ articles across:

- Yoruba (yo), Swahili (sw), Igbo (ig), Hausa (ha) - African markets, the moat
- Spanish (es), French (fr), Portuguese (pt) - widely covered, easy verifier baseline
- Arabic (ar) - non-Latin script, RTL
- Mandarin (zh) - non-Latin, MEXC audience
- Filler English (en) controls

Mix in deliberate "not tradable" articles (opinion pieces, evergreen explainers, lifestyle
features) so the rubric scores them low and the agent learns to reject.

## Running

```
npm run eval
```

Writes `eval/output/<timestamp>.json` and one Langfuse trace per fixture.

## Gate

Phase 2 exit requires the average qualityAverage across all fixtures to clear 0.70.
Phase 1 ships a stub pipeline so scores will be low; that's expected.

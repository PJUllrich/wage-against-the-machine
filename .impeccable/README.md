# Impeccable config

Detector settings for [impeccable](https://github.com/pbakaus/impeccable), run over
this project with:

    npx impeccable detect index.html data.html sources.html styles.css

The first pass reported 95 findings. Everything objective was fixed: WCAG AA contrast
on the muted grey and the ochre, an 11px floor on functional text, a skipped heading
level, and a table sitting flush against its container's border. Long labels moved from
tracked uppercase to 12px sentence case, which cleared the all-caps, tiny-text and
wide-tracking rules together.

Four rules are ignored on purpose, with reasons recorded in `config.json` under
`detector.ignoreRuleReasons`, plus one value ignore for Inter as the body face. Those
are design decisions rather than defects; re-read them before assuming they are stale.

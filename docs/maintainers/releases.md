# Releases

Changesets is Vooya's only version planner. The five published packages form one
fixed release group; never edit their versions or internal exact dependencies by
hand.

## Inspect before changing state

```sh
npm run release:status
npm run verify:release
```

In alpha pre-mode, markdown files named by `pre.json.changesets` are already
consumed release history. Their continued presence does not mean they will be
published again. Do not delete them manually.

## Publish another alpha

Add one reviewed changeset for user-visible work, then run:

```sh
npm run version:packages
npm run verify:release
npm run release:alpha
```

Review the version, lockfile, exact internal dependencies, tarballs, and npm
dist-tags before the last command. `release:alpha` is the only command in this
sequence that publishes to npm.

## First stable release

Only after the ABI and documented support matrix are intentionally frozen:

```sh
npm run changeset pre exit
npm run version:packages
npm run verify:release
```

Review and commit the stable version plan before publishing. The stable version
step removes `pre.json` and the consumed changeset markdown as part of the
Changesets lifecycle; that is expected release bookkeeping, not cleanup.

# lingo
Vocabulary Trainer

Displays example sentences and their translations. Exercises request picking correct translations or building them from a bunch of given words.

Runnable version at https://augustuskling.github.io/lingo/ which stores progress in the browser's `localStorage` only. No account required.

## Data source
Example sentences are mostly imported from Tatoeba. Additional excercises can be put as yml files in the `exercises` folder.

You can find Tatoeba's sentenences and translations to various langages on https://tatoeba.org/en/downloads and integrate them using `import-tatoeba.mjs` (converts TSV to yml files) and `build-courses.js` (constructs courses from exercises and lessons).

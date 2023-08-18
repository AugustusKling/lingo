# lingo
Vocabulary Trainer

Displays or reads example sentences and their translations. Exercises request picking correct translations or building them from a bunch of given words. Voice exercises are based on your device's text-to-speech feature.

Runnable version at https://augustuskling.github.io/lingo/ which stores progress in the browser's `localStorage` only. No account required.

## Data source
Example sentences are imported from [Tatoeba](https://tatoeba.org/). Excercises can be grouped into thematic lessions by putting yml files in the `lessons` folder.

You can find Tatoeba's sentenences and translations to various langages on https://tatoeba.org/en/downloads and integrate them using `build-tatoeba-course.mjs`.

Steps to generate a course for a new language pair.
1. Get sentences from https://downloads.tatoeba.org/exports/per_language/LANGUAGE_CODE/LANGUAGE_CODE_sentences_detailed.tsv.bz2 for source and target language (replace LANGUAGE_CODE with the respective language codes).
2. Get sentence links for the two languages from https://downloads.tatoeba.org/exports/per_language/SOURCE_LANGUAGE_CODE/SOURCE_LANGUAGE_CODE-TARGET_LANGUAGE_CODE_links.tsv.bz2 (replace SOURCE_LANGUAGE_CODE and TARGET_LANGUAGE_CODE with the respective language codes).
3. Get sentence links from English to the two languages from https://downloads.tatoeba.org/exports/per_language/eng/eng-LANGUAGE_CODE_links.tsv.bz2 (replace LANGUAGE_CODE with the respective language codes). This provides the grouping of sentences into lessons.
4. Get sentence tags from https://downloads.tatoeba.org/exports/tags.tar.bz2 which also provides the grouping of sentences into lessons.
5. Run course compiler: `node build-tatoeba-course.mjs SOURCE_LANGUAGE_CODE TARGET_LANGUAGE_CODE` (replace SOURCE_LANGUAGE_CODE and TARGET_LANGUAGE_CODE with the respective language codes)

Exercises will only be shown for sentences that are linked as direct translations of each other.

## Lesson format
```yml
# Order of courses in course list
order: 5

title:
 eng: "Kitchen"
 deu: "Küche"
 swe: Kök
description:
 eng: "Cooking and ingredients"
 deu: Kochen und Zutaten

# Sentences making up the lesson given by Tatoeba sentence ids in either source language, target language or English.
exercises:
  - 310737
  - 10136126
  - 10207593

# Sentences making up the lesson given by Tatoeba tag name.
exerciseTags:
  - Küche
  - kitchen
  - food
  - fruit
  - cooking

```

The course compiler ignores sentences from lessons if it cannot relate them to your source and target languages. Lessons with no remaining sentences are excluded.

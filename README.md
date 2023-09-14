# lingo
Vocabulary Trainer

Displays or reads example sentences and their translations. Exercises request picking correct translations or building them from a bunch of given words. Voice exercises are based on your device's text-to-speech feature.

Runnable version at https://augustuskling.github.io/lingo/ which stores progress in the browser's `localStorage` only. No account required.

## Data source
Example sentences are imported from [Tatoeba](https://tatoeba.org/). Excercises can be grouped into thematic lessions by putting yml files in the `lessons` folder.

You can find Tatoeba's sentenences and translations to various langages on https://tatoeba.org/en/downloads and integrate them using `build-tatoeba-course.mjs`.

Run the course compiler to generate a course for a new language pair.

`node build-tatoeba-course.mjs SOURCE_LANGUAGE_CODE TARGET_LANGUAGE_CODE` (replace SOURCE_LANGUAGE_CODE and TARGET_LANGUAGE_CODE with the respective ISO-639-3 language codes)

Then run `yarn build` to create a static website containing the new course.

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

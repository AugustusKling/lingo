# lingo
Vocabulary Trainer

Displays or reads example sentences and their translations. Exercises request picking correct translations or building them from a bunch of given words. Voice exercises are based on your device's text-to-speech feature.

Runnable version at https://augustuskling.github.io/lingo/ which caches courses to work offline. Progress is stored in the browser's `localStorage` only. No account required.

<img src="https://github.com/AugustusKling/lingo/assets/599177/e4432013-921b-4500-978b-8445f9a0ac23" width=200>
<img src="https://github.com/AugustusKling/lingo/assets/599177/20426cf5-c753-40b5-af79-723547d69258" width=200>
<img src="https://github.com/AugustusKling/lingo/assets/599177/0d01e168-ae7a-49c6-b360-7b7af25dad9d" width=200>
<img src="https://github.com/AugustusKling/lingo/assets/599177/e50046e8-f3fe-48ad-8682-ca888866a606" width=200>


## Data source
Example sentences are imported from [Tatoeba](https://tatoeba.org/). Excercises can be grouped into thematic lessions by putting yml files in the `lessons` folder.

You can find Tatoeba's sentenences and translations to various langages on https://tatoeba.org/en/downloads and integrate them using `build-tatoeba-course.mjs`.

Run the course compiler to generate a course for a new language pair.

`node build-tatoeba-course.mjs SOURCE_LANGUAGE_CODE TARGET_LANGUAGE_CODE` (replace SOURCE_LANGUAGE_CODE and TARGET_LANGUAGE_CODE with the respective ISO-639-3 language codes)

Then run `yarn build` to create a static website containing the new course.

Exercises will only be shown for sentences that are linked as direct translations of each other. IPA transcription is generated using espeak-ng for target languages where a mapping of language to espeak-ng voice is known.

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

# Sentences making up the lesson given by Tatoeba list id.
lists:
  - 171778
```

The course compiler ignores sentences from lessons if it cannot relate them to your source and target languages. Lessons with no remaining sentences are excluded.

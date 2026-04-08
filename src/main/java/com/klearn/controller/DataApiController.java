package com.klearn.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.klearn.model.*;
import com.klearn.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * REST API providing learning data to the frontend JavaScript.
 * The JS on each page calls these endpoints to get data from the database
 * instead of the static data.js file.
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DataApiController {

    private final HangulCharacterRepository hangulRepo;
    private final VocabWordRepository vocabRepo;
    private final GrammarLessonRepository grammarRepo;
    private final ExerciseRepository exerciseRepository;
    private final SpeakingExerciseRepository speakingRepo;
    private final ReadingPassageRepository readingPassageRepository;
    private final VocabularyRepository vocabularyRepository;
    private final WritingCharRepo charRepo;
    private final WritingTranslateRepo translateRepo;

    @GetMapping("/hangul")
    public ResponseEntity<Map<String, List<HangulCharacter>>> getHangul() {
        Map<String, List<HangulCharacter>> data = new LinkedHashMap<>();
        data.put("consonants", hangulRepo.findByTypeOrderByIdAsc("consonants"));
        data.put("vowels", hangulRepo.findByTypeOrderByIdAsc("vowels"));
        data.put("double", hangulRepo.findByTypeOrderByIdAsc("double"));
        data.put("compound", hangulRepo.findByTypeOrderByIdAsc("compound"));
        return ResponseEntity.ok(data);
    }

    @GetMapping("/vocab")
    public ResponseEntity<List<VocabWord>> getVocab(
            @RequestParam(value = "category", required = false) String category) {
        if (category != null && !category.equals("all")) {
            return ResponseEntity.ok(vocabRepo.findByCategoryOrderByIdAsc(category));
        }
        return ResponseEntity.ok(vocabRepo.findAll());
    }

    @GetMapping("/vocab/categories")
    public ResponseEntity<Map<String, String>> getVocabCategories() {
        Map<String, String> categories = new LinkedHashMap<>();
        categories.put("greeting", "🤝 Chào hỏi");
        categories.put("number", "🔢 Số đếm");
        categories.put("family", "👨\u200D👩\u200D👧\u200D👦 Gia đình");
        categories.put("food", "🍜 Thức ăn");
        categories.put("travel", "✈️ Du lịch");
        categories.put("time", "⏰ Thời gian");
        return ResponseEntity.ok(categories);
    }

    @GetMapping("/grammar")
    public ResponseEntity<List<GrammarLesson>> getGrammar() {
        return ResponseEntity.ok(grammarRepo.findAll());
    }

    @GetMapping("/lessons/{lessonId}/listening") // Đảm bảo đúng path bạn gọi từ JS
    @ResponseBody
    @Transactional(readOnly = true)
    public ResponseEntity<?> getListeningByLesson(@PathVariable Long lessonId) {
        try {
            List<Exercise> exercises = exerciseRepository.findByLesson_LessonIdAndType(
                    lessonId, Exercise.ExerciseType.listening);

            if (exercises == null || exercises.isEmpty()) {
                return ResponseEntity.ok(new ArrayList<>());
            }

            List<Map<String, Object>> result = new ArrayList<>();

            for (Exercise ex : exercises) {
                Map<String, Object> passage = new HashMap<>();
                passage.put("audioUrl", ex.getAudioUrl());
                passage.put("level", ex.getLevel() != null ? ex.getLevel() : "N/A");

                List<Map<String, Object>> questionsList = new ArrayList<>();
                if (ex.getQuestions() != null) {
                    for (Question q : ex.getQuestions()) {
                        Map<String, Object> qMap = new HashMap<>();
                        qMap.put("q", q.getContent());

                        List<String> options = new ArrayList<>();
                        int correctIndex = -1;

                        if (q.getAnswers() != null) {
                            for (int i = 0; i < q.getAnswers().size(); i++) {
                                Answer a = q.getAnswers().get(i);
                                options.add(a.getContent());
                                if (Boolean.TRUE.equals(a.getIsCorrect())) {
                                    correctIndex = i;
                                }
                            }
                        }
                        qMap.put("options", options);
                        qMap.put("answer", correctIndex);
                        questionsList.add(qMap);
                    }
                }
                passage.put("questions", questionsList);
                result.add(passage);
            }
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            e.printStackTrace(); // In lỗi ra Console để xem chính xác lỗi gì
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Lỗi server: " + e.getMessage());
        }
    }
    @GetMapping("/lessons/{lessonId}/speaking")
    public ResponseEntity<List<SpeakingExercise>> getSpeakingByLesson(@PathVariable Long lessonId) {
        return ResponseEntity.ok(speakingRepo.findByLesson_LessonId(lessonId));
    }
    @GetMapping("/lessons/{lessonId}/reading")
    public ResponseEntity<List<Map<String, Object>>> getReadingByLesson(@PathVariable Long lessonId) {

        List<ReadingPassage> passages =
                readingPassageRepository.findByLesson_LessonId(lessonId);

        List<Map<String, Object>> result = new ArrayList<>();

        for (ReadingPassage p : passages) {
            Map<String, Object> map = new HashMap<>();

            map.put("level", p.getLevel());
            map.put("text", p.getText());
            map.put("translation", p.getTranslation());

            try {
                ObjectMapper mapper = new ObjectMapper();

                List<Map<String, Object>> questions =
                        mapper.readValue(
                                p.getQuestions(),
                                new com.fasterxml.jackson.core.type.TypeReference<List<Map<String, Object>>>() {}
                        );

                map.put("questions", questions);

            } catch (Exception e) {
                map.put("questions", new ArrayList<>());
            }

            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    @GetMapping("/lessons/{lessonId}/writing/chars")
    public List<WritingCharExercise> getChars(@PathVariable Long lessonId) {
        return charRepo.findByLesson_LessonId(lessonId);
    }

    @GetMapping("/lessons/{lessonId}/writing/translate")
    public List<WritingTranslateExercise> getTranslate(@PathVariable Long lessonId) {
        return translateRepo.findByLesson_LessonId(lessonId);
    }
}

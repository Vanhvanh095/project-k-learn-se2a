package com.klearn.controller;

import com.klearn.model.Vocabulary;
import com.klearn.repository.ExerciseRepository;
import com.klearn.repository.VocabularyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/quiz")
@RequiredArgsConstructor
public class QuizApiController {

    private final VocabularyRepository vocabularyRepository;
    private final ExerciseRepository exerciseRepository;

    @GetMapping("/generate")
    public ResponseEntity<List<Map<String, Object>>> generateQuiz(@RequestParam String type) {
        List<Map<String, Object>> quizQuestions = new ArrayList<>();

        if ("vocab".equals(type)) {
            List<Vocabulary> vocabs = vocabularyRepository.findRandomVocabs(10);
            // Lấy tất cả nghĩa để làm đáp án nhiễu
            List<String> allMeanings = vocabs.stream().map(Vocabulary::getMeaning).collect(Collectors.toList());

            for (Vocabulary v : vocabs) {
                Map<String, Object> q = new HashMap<>();
                q.put("question", v.getHangul());
                q.put("correctAnswer", v.getMeaning());
                q.put("options", generateRandomOptions(v.getMeaning(), allMeanings));
                quizQuestions.add(q);
            }
        }
        // ... logic cho listening tương tự ...
        return ResponseEntity.ok(quizQuestions);
    }

    // THÊM HÀM NÀY VÀO TRONG CLASS
    private List<String> generateRandomOptions(String correct, List<String> allOptions) {
        List<String> options = new ArrayList<>();
        options.add(correct);

        // Lấy thêm các đáp án sai (không trùng với correct)
        List<String> distractors = allOptions.stream()
                .filter(s -> !s.equals(correct))
                .collect(Collectors.toList());

        Collections.shuffle(distractors); // Trộn ngẫu nhiên các đáp án sai

        // Lấy 3 đáp án sai đầu tiên
        for (int i = 0; i < Math.min(3, distractors.size()); i++) {
            options.add(distractors.get(i));
        }

        Collections.shuffle(options); // Trộn lần cuối để đáp án đúng không luôn ở vị trí đầu
        return options;
    }
}


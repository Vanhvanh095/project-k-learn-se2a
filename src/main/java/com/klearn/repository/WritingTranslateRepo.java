package com.klearn.repository;

import com.klearn.model.WritingTranslateExercise;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WritingTranslateRepo extends JpaRepository<WritingTranslateExercise, Long> {
    List<WritingTranslateExercise> findByLesson_LessonId(Long lessonId);
}

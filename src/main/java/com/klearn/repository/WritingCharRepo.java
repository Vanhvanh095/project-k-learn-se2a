package com.klearn.repository;

import com.klearn.model.WritingCharExercise;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WritingCharRepo extends JpaRepository<WritingCharExercise, Long> {
    List<WritingCharExercise> findByLesson_LessonId(Long lessonId);
}


package com.klearn.repository;

import com.klearn.model.SpeakingExercise;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SpeakingExerciseRepository extends JpaRepository<SpeakingExercise, Long> {
    List<SpeakingExercise> findByLesson_LessonId(Long lessonId);
}

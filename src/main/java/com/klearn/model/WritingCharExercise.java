package com.klearn.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "writing_char_exercises")
@Data
public class WritingCharExercise {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "hangul", nullable = false)
    private String hangul;

    private String roman;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Lesson lesson;
}

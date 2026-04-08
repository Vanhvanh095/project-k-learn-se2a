package com.klearn.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "speaking_exercises")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class SpeakingExercise {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String kr;

    @Column(nullable = false, length = 200)
    private String roman;

    @Column(nullable = false, length = 200)
    private String vi;

    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lesson_id")
    private Lesson lesson;
}

package com.klearn.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import java.util.List;

@Entity
@Table(name = "question")
@Data
@NoArgsConstructor
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "question_id")
    private Long questionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exercise_id", nullable = false)
    @ToString.Exclude
    @JsonBackReference // Ngăn vòng lặp vô tận khi Jackson convert sang JSON
    private Exercise exercise;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    // Trường này có thể dùng cho bài tập Speaking/Writing nếu cần
    @Column(name = "expected_text", length = 500)
    private String expectedText;

    /**
     * Danh sách các câu trả lời lựa chọn.
     * FetchType.LAZY là tốt, nhưng trong Controller cần dùng @Transactional
     * hoặc truy vấn JOIN FETCH để tránh LazyInitializationException.
     */
    @OneToMany(mappedBy = "question", fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @OrderBy("answerId ASC")
    @JsonManagedReference // Quản lý quan hệ cha-con khi trả về JSON
    private List<Answer> answers;
}
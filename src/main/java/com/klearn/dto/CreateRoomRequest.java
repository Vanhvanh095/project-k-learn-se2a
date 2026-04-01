package com.klearn.dto;

import lombok.Data;

@Data
public class CreateRoomRequest {
    private String roomName;
    private Integer maxParticipants;
    private String description;
}

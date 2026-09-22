package com.cravedash.auth.exception;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Uniform error payload returned by all services, e.g.
 * { "timestamp": "...", "status": 404, "message": "...", "path": "/api/..." }
 */
@Data
@AllArgsConstructor
public class ErrorResponse {

    private LocalDateTime timestamp;
    private int status;
    private String message;
    private String path;
}

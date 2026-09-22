package com.cravedash.order.exception;

import org.springframework.http.HttpStatus;

/** Thrown when the caller is authenticated but not allowed to touch this order. */
public class AccessDeniedException extends RuntimeException {

    private final HttpStatus status = HttpStatus.FORBIDDEN;

    public AccessDeniedException(String message) {
        super(message);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

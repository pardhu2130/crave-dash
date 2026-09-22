package com.cravedash.order.exception;

import org.springframework.http.HttpStatus;

/** Thrown when a status change is not allowed from the order's current state. */
public class InvalidOrderStateException extends RuntimeException {

    private final HttpStatus status = HttpStatus.CONFLICT;

    public InvalidOrderStateException(String message) {
        super(message);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

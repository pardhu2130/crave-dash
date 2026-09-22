package com.cravedash.auth.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when registration attempts to reuse an email address.
 */
public class EmailAlreadyExistsException extends RuntimeException {

    private final HttpStatus status = HttpStatus.CONFLICT;

    public EmailAlreadyExistsException(String message) {
        super(message);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

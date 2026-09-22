package com.cravedash.auth.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when login credentials are wrong.
 */
public class InvalidCredentialsException extends RuntimeException {

    private final HttpStatus status = HttpStatus.UNAUTHORIZED;

    public InvalidCredentialsException(String message) {
        super(message);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

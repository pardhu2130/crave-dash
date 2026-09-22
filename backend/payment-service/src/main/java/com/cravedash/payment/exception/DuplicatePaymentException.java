package com.cravedash.payment.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a second payment is attempted for the same order.
 */
public class DuplicatePaymentException extends RuntimeException {

    private final HttpStatus status = HttpStatus.CONFLICT;

    public DuplicatePaymentException(String message) {
        super(message);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

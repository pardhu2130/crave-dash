package com.cravedash.payment.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown by the simulated gateway when a payment cannot be processed.
 */
public class PaymentException extends RuntimeException {

    private final HttpStatus status = HttpStatus.PAYMENT_REQUIRED;

    public PaymentException(String message) {
        super(message);
    }

    public PaymentException(String message, Throwable cause) {
        super(message, cause);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

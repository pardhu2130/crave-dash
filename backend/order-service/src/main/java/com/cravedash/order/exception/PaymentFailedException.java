package com.cravedash.order.exception;

import org.springframework.http.HttpStatus;

/** Thrown when payment-service declines the payment for a new order. */
public class PaymentFailedException extends RuntimeException {

    private final HttpStatus status = HttpStatus.PAYMENT_REQUIRED;

    public PaymentFailedException(String message) {
        super(message);
    }

    public PaymentFailedException(String message, Throwable cause) {
        super(message, cause);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

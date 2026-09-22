package com.cravedash.payment.exception;

import org.springframework.http.HttpStatus;

/**
 * Thrown when a refund is requested for a payment that is not refundable.
 */
public class InvalidRefundException extends RuntimeException {

    private final HttpStatus status = HttpStatus.BAD_REQUEST;

    public InvalidRefundException(String message) {
        super(message);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

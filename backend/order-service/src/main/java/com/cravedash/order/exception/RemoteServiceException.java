package com.cravedash.order.exception;

import org.springframework.http.HttpStatus;

/** Thrown when a downstream service (restaurant/payment) cannot be reached or fails. */
public class RemoteServiceException extends RuntimeException {

    private final HttpStatus status = HttpStatus.BAD_GATEWAY;

    public RemoteServiceException(String message) {
        super(message);
    }

    public RemoteServiceException(String message, Throwable cause) {
        super(message, cause);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

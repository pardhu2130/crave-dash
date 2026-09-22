package com.cravedash.order.exception;

import org.springframework.http.HttpStatus;

/** Thrown when a requested menu item is missing from the menu or sold out. */
public class OrderItemUnavailableException extends RuntimeException {

    private final HttpStatus status = HttpStatus.BAD_REQUEST;

    public OrderItemUnavailableException(String message) {
        super(message);
    }

    public HttpStatus getStatus() {
        return status;
    }
}

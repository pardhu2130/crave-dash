package com.cravedash.order.entity;

/**
 * Local mirror of the payment outcome. Named PaymentState to keep it clearly
 * distinct from the payment-service PaymentStatus enum.
 */
public enum PaymentState {
    PENDING,
    PAID,
    FAILED,
    REFUNDED
}

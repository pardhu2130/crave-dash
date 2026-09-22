package com.cravedash.order.client.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** Request body sent to payment-service. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PaymentRequestDto {

    private Long orderId;
    private Long customerId;
    private BigDecimal amount;
    private String paymentMethod;
}

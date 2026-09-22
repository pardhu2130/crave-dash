package com.cravedash.order.client.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Request body sent to payment-service when refunding. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RefundRequestDto {

    private String reason;
}

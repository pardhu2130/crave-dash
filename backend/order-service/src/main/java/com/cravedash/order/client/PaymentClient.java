package com.cravedash.order.client;

import com.cravedash.order.client.dto.PaymentDto;
import com.cravedash.order.client.dto.PaymentRequestDto;
import com.cravedash.order.client.dto.RefundRequestDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/** Talks to payment-service through Eureka service discovery. */
@FeignClient(name = "PAYMENT-SERVICE")
public interface PaymentClient {

    @PostMapping("/api/payments")
    PaymentDto processPayment(@RequestBody PaymentRequestDto request);

    @PostMapping("/api/payments/{id}/refund")
    PaymentDto refundPayment(@PathVariable("id") Long paymentId, @RequestBody RefundRequestDto request);
}

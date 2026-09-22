package com.cravedash.order.dto;

import com.cravedash.order.entity.OrderStatus;
import com.cravedash.order.entity.PaymentMethod;
import com.cravedash.order.entity.PaymentState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponse {

    private Long id;
    private Long customerId;
    private String customerEmail;
    private String customerName;
    private Long restaurantId;
    private String restaurantName;
    private String deliveryAddress;
    private String notes;
    private OrderStatus status;
    private PaymentState paymentState;
    private PaymentMethod paymentMethod;
    private Long paymentId;
    private String transactionId;
    private Long deliveryAgentId;
    private String deliveryAgentName;
    private BigDecimal subtotal;
    private BigDecimal deliveryFee;
    private BigDecimal totalAmount;
    private String cancellationReason;
    private List<OrderItemResponse> items;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

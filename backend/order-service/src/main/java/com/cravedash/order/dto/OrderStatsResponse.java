package com.cravedash.order.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/** Snapshot counters used by the admin and fulfillment dashboards. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderStatsResponse {

    private long totalOrders;
    private long pending;
    private long active;
    private long delivered;
    private long cancelled;
    private long awaitingCourier;
    private BigDecimal capturedRevenue;
}

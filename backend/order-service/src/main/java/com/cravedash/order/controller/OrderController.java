package com.cravedash.order.controller;

import com.cravedash.order.dto.CancelOrderRequest;
import com.cravedash.order.dto.CreateOrderRequest;
import com.cravedash.order.dto.OrderItemResponse;
import com.cravedash.order.dto.OrderResponse;
import com.cravedash.order.dto.OrderStatsResponse;
import com.cravedash.order.dto.UpdateOrderStatusRequest;
import com.cravedash.order.entity.OrderStatus;
import com.cravedash.order.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * All routes are reached through the API gateway, which authenticates the JWT
 * and forwards X-User-Id / X-User-Email / X-User-Role headers.
 */
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping
    public ResponseEntity<OrderResponse> placeOrder(
            @Valid @RequestBody CreateOrderRequest request,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {
        OrderResponse created = orderService.createOrder(request, userId, userEmail);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/mine")
    public ResponseEntity<List<OrderResponse>> myOrders(
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(orderService.getOrdersForCustomer(userId, userId, "CUSTOMER"));
    }

    @GetMapping("/customer/{customerId}")
    public ResponseEntity<List<OrderResponse>> ordersByCustomer(
            @PathVariable Long customerId,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(orderService.getOrdersForCustomer(customerId, userId, role));
    }

    @GetMapping("/restaurant/{restaurantId}")
    public ResponseEntity<List<OrderResponse>> ordersByRestaurant(@PathVariable Long restaurantId) {
        return ResponseEntity.ok(orderService.getOrdersForRestaurant(restaurantId));
    }

    @GetMapping("/agent/mine")
    public ResponseEntity<List<OrderResponse>> myDeliveries(
            @RequestHeader("X-User-Id") Long userId) {
        return ResponseEntity.ok(orderService.getOrdersForAgent(userId));
    }

    @GetMapping("/agent/available")
    public ResponseEntity<List<OrderResponse>> availableDeliveries() {
        return ResponseEntity.ok(orderService.getUnassignedReadyOrders());
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<List<OrderResponse>> ordersByStatus(@PathVariable OrderStatus status) {
        return ResponseEntity.ok(orderService.getOrdersByStatus(status));
    }

    @GetMapping("/stats")
    public ResponseEntity<OrderStatsResponse> stats() {
        return ResponseEntity.ok(orderService.getStats());
    }

    @GetMapping
    public ResponseEntity<List<OrderResponse>> allOrders() {
        return ResponseEntity.ok(orderService.getAllOrders());
    }

    @GetMapping("/{id}")
    public ResponseEntity<OrderResponse> getOrder(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(orderService.getOrder(id, userId, role));
    }

    @GetMapping("/{id}/items")
    public ResponseEntity<List<OrderItemResponse>> getOrderItems(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(orderService.getOrderItems(id, userId, role));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<OrderResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrderStatusRequest request,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return ResponseEntity.ok(
                orderService.updateStatus(id, request.getStatus(), userId, displayName(userEmail), role));
    }

    @PostMapping("/{id}/claim")
    public ResponseEntity<OrderResponse> claimOrder(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail) {
        return ResponseEntity.ok(orderService.claimOrder(id, userId, displayName(userEmail)));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<OrderResponse> cancelOrder(
            @PathVariable Long id,
            @RequestBody(required = false) CancelOrderRequest request,
            @RequestHeader(value = "X-User-Id", required = false) Long userId,
            @RequestHeader(value = "X-User-Role", required = false) String role) {
        String reason = request == null ? null : request.getReason();
        return ResponseEntity.ok(orderService.cancelOrder(id, reason, userId, role));
    }

    /** The email doubles as a human-readable courier label when no profile name is available. */
    private String displayName(String email) {
        if (email == null || email.isBlank()) {
            return "Delivery agent";
        }
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }
}

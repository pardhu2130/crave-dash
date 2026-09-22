package com.cravedash.order.service;

import com.cravedash.order.client.PaymentClient;
import com.cravedash.order.client.RestaurantClient;
import com.cravedash.order.client.dto.MenuItemDto;
import com.cravedash.order.client.dto.PaymentDto;
import com.cravedash.order.client.dto.PaymentRequestDto;
import com.cravedash.order.client.dto.RefundRequestDto;
import com.cravedash.order.client.dto.RestaurantDto;
import com.cravedash.order.dto.CreateOrderRequest;
import com.cravedash.order.dto.OrderItemRequest;
import com.cravedash.order.dto.OrderItemResponse;
import com.cravedash.order.dto.OrderResponse;
import com.cravedash.order.dto.OrderStatsResponse;
import com.cravedash.order.entity.Order;
import com.cravedash.order.entity.OrderItem;
import com.cravedash.order.entity.OrderStatus;
import com.cravedash.order.entity.PaymentState;
import com.cravedash.order.exception.AccessDeniedException;
import com.cravedash.order.exception.InvalidOrderStateException;
import com.cravedash.order.exception.OrderItemUnavailableException;
import com.cravedash.order.exception.PaymentFailedException;
import com.cravedash.order.exception.RemoteServiceException;
import com.cravedash.order.exception.ResourceNotFoundException;
import com.cravedash.order.repository.OrderItemRepository;
import com.cravedash.order.repository.OrderRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private static final Set<String> STAFF_ROLES = Set.of("ADMIN", "RESTAURANT_ADMIN", "DELIVERY_AGENT");

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final RestaurantClient restaurantClient;
    private final PaymentClient paymentClient;

    /** Initialised so unit tests can construct the service without a Spring context. */
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Value("${order.delivery.fee:2.99}")
    private BigDecimal deliveryFee = new BigDecimal("2.99");

    @Value("${order.delivery.free-threshold:30.00}")
    private BigDecimal freeDeliveryThreshold = new BigDecimal("30.00");

    // ------------------------------------------------------------------
    // Order placement
    // ------------------------------------------------------------------

    /**
     * Places an order: resolves the restaurant and menu from restaurant-service,
     * prices the basket locally, then charges payment-service. A declined payment
     * leaves an auditable CANCELLED order instead of a silent failure.
     */
    public OrderResponse createOrder(CreateOrderRequest request, Long customerId, String customerEmail) {
        if (customerId == null) {
            throw new AccessDeniedException("Sign in before placing an order");
        }

        RestaurantDto restaurant = fetchRestaurant(request.getRestaurantId());
        if (Boolean.FALSE.equals(restaurant.getActive())) {
            throw new OrderItemUnavailableException(
                    restaurant.getName() + " is not accepting orders right now");
        }

        Map<Long, MenuItemDto> menu = new HashMap<>();
        for (MenuItemDto item : fetchMenu(request.getRestaurantId())) {
            menu.put(item.getId(), item);
        }

        Order order = Order.builder()
                .customerId(customerId)
                .customerEmail(customerEmail)
                .customerName(request.getCustomerName())
                .restaurantId(restaurant.getId())
                .restaurantName(restaurant.getName())
                .deliveryAddress(request.getDeliveryAddress())
                .notes(request.getNotes())
                .paymentMethod(request.getPaymentMethod())
                .status(OrderStatus.PENDING)
                .paymentState(PaymentState.PENDING)
                .build();

        BigDecimal subtotal = BigDecimal.ZERO;
        for (OrderItemRequest line : request.getItems()) {
            MenuItemDto menuItem = menu.get(line.getMenuItemId());
            if (menuItem == null) {
                throw new OrderItemUnavailableException("Menu item " + line.getMenuItemId()
                        + " is not on the menu of " + restaurant.getName());
            }
            if (Boolean.FALSE.equals(menuItem.getAvailable())) {
                throw new OrderItemUnavailableException(
                        menuItem.getName() + " is sold out right now. Remove it and try again.");
            }

            BigDecimal unitPrice = menuItem.getPrice().setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineTotal = unitPrice
                    .multiply(BigDecimal.valueOf(line.getQuantity()))
                    .setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(lineTotal);

            order.addItem(OrderItem.builder()
                    .menuItemId(menuItem.getId())
                    .itemName(menuItem.getName())
                    .unitPrice(unitPrice)
                    .quantity(line.getQuantity())
                    .specialInstructions(line.getSpecialInstructions())
                    .lineTotal(lineTotal)
                    .build());
        }

        BigDecimal fee = deliveryFeeFor(subtotal);
        BigDecimal pricedSubtotal = subtotal.setScale(2, RoundingMode.HALF_UP);
        order.setSubtotal(pricedSubtotal);
        order.setDeliveryFee(fee);
        order.setTotalAmount(pricedSubtotal.add(fee).setScale(2, RoundingMode.HALF_UP));

        Order saved = orderRepository.save(order);
        log.info("Order {} created for customer {} at restaurant {} for {}",
                saved.getId(), customerId, restaurant.getName(), saved.getTotalAmount());

        return charge(saved);
    }

    private OrderResponse charge(Order order) {
        try {
            PaymentDto payment = paymentClient.processPayment(PaymentRequestDto.builder()
                    .orderId(order.getId())
                    .customerId(order.getCustomerId())
                    .amount(order.getTotalAmount())
                    .paymentMethod(order.getPaymentMethod().name())
                    .build());

            order.setPaymentState(toPaymentState(payment.getPaymentStatus()));
            order.setPaymentId(payment.getId());
            order.setTransactionId(payment.getTransactionId());
            Order paid = orderRepository.save(order);
            log.info("Order {} payment {} => {}", paid.getId(), payment.getId(), paid.getPaymentState());
            return toResponse(paid);
        } catch (FeignException ex) {
            order.setPaymentState(PaymentState.FAILED);
            order.setStatus(OrderStatus.CANCELLED);
            order.setCancellationReason("Payment declined");
            orderRepository.save(order);

            if (ex.status() == 402) {
                throw new PaymentFailedException(extractMessage(ex,
                        "Payment for order " + order.getId() + " was declined. Try another method."));
            }
            throw new RemoteServiceException("Payment service error: " + ex.getMessage(), ex);
        }
    }

    // ------------------------------------------------------------------
    // Reads
    // ------------------------------------------------------------------

    @Transactional(readOnly = true)
    public OrderResponse getOrder(Long id, Long requesterId, String role) {
        Order order = getOrderEntity(id);
        assertVisible(order, requesterId, role);
        return toResponse(order);
    }

    @Transactional(readOnly = true)
    public List<OrderItemResponse> getOrderItems(Long orderId, Long requesterId, String role) {
        Order order = getOrderEntity(orderId);
        assertVisible(order, requesterId, role);
        return orderItemRepository.findByOrderId(orderId).stream()
                .map(this::toItemResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getOrdersForCustomer(Long customerId, Long requesterId, String role) {
        assertStaffOrSelf(customerId, requesterId, role);
        return orderRepository.findByCustomerIdOrderByCreatedAtDesc(customerId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getOrdersForRestaurant(Long restaurantId) {
        return orderRepository.findByRestaurantIdOrderByCreatedAtDesc(restaurantId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getOrdersForAgent(Long agentId) {
        return orderRepository.findByDeliveryAgentIdOrderByCreatedAtDesc(agentId).stream()
                .map(this::toResponse)
                .toList();
    }

    /** READY_FOR_PICKUP orders that no courier has claimed yet. */
    @Transactional(readOnly = true)
    public List<OrderResponse> getUnassignedReadyOrders() {
        return orderRepository
                .findByStatusAndDeliveryAgentIdIsNullOrderByCreatedAtAsc(OrderStatus.READY_FOR_PICKUP)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getOrdersByStatus(OrderStatus status) {
        return orderRepository.findByStatusOrderByCreatedAtAsc(status).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> getAllOrders() {
        return orderRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrderStatsResponse getStats() {
        List<Order> all = orderRepository.findAll();
        BigDecimal revenue = all.stream()
                .filter(o -> o.getPaymentState() == PaymentState.PAID)
                .map(Order::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        return OrderStatsResponse.builder()
                .totalOrders(all.size())
                .pending(all.stream().filter(o -> o.getStatus() == OrderStatus.PENDING).count())
                .active(all.stream().filter(o -> !o.getStatus().isTerminal()).count())
                .delivered(all.stream().filter(o -> o.getStatus() == OrderStatus.DELIVERED).count())
                .cancelled(all.stream().filter(o -> o.getStatus() == OrderStatus.CANCELLED).count())
                .awaitingCourier(all.stream().filter(o -> o.getStatus() == OrderStatus.READY_FOR_PICKUP
                        && o.getDeliveryAgentId() == null).count())
                .capturedRevenue(revenue)
                .build();
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    @Transactional
    public OrderResponse updateStatus(Long id, OrderStatus next, Long requesterId, String requesterName, String role) {
        Order order = getOrderEntity(id);

        if (!order.getStatus().canTransitionTo(next)) {
            throw new InvalidOrderStateException("Order " + id + " cannot move from "
                    + order.getStatus() + " to " + next);
        }
        if (order.getPaymentState() != PaymentState.PAID && next != OrderStatus.CANCELLED) {
            throw new InvalidOrderStateException("Order " + id + " has no successful payment yet");
        }

        // A courier moving an unclaimed order to OUT_FOR_DELIVERY claims it implicitly.
        if (next == OrderStatus.OUT_FOR_DELIVERY && order.getDeliveryAgentId() == null) {
            if (requesterId == null || !"DELIVERY_AGENT".equals(role)) {
                throw new AccessDeniedException("Only a delivery agent can start this delivery");
            }
            order.setDeliveryAgentId(requesterId);
            order.setDeliveryAgentName(requesterName);
        }

        order.setStatus(next);
        Order saved = orderRepository.save(order);
        log.info("Order {} status => {}", saved.getId(), saved.getStatus());
        return toResponse(saved);
    }

    /** Assigns the calling courier to a READY_FOR_PICKUP order. */
    @Transactional
    public OrderResponse claimOrder(Long id, Long agentId, String agentName) {
        if (agentId == null) {
            throw new AccessDeniedException("Sign in as a delivery agent to claim orders");
        }
        Order order = getOrderEntity(id);
        if (order.getStatus() != OrderStatus.READY_FOR_PICKUP) {
            throw new InvalidOrderStateException(
                    "Order " + id + " is " + order.getStatus() + " and cannot be claimed yet");
        }
        if (order.getDeliveryAgentId() != null) {
            throw new InvalidOrderStateException("Order " + id + " is already assigned to "
                    + order.getDeliveryAgentName());
        }
        order.setDeliveryAgentId(agentId);
        order.setDeliveryAgentName(agentName);
        return toResponse(orderRepository.save(order));
    }

    @Transactional
    public OrderResponse cancelOrder(Long id, String reason, Long requesterId, String role) {
        Order order = getOrderEntity(id);
        assertVisible(order, requesterId, role);

        if (!order.getStatus().isCancellable()) {
            throw new InvalidOrderStateException(
                    "Order " + id + " is " + order.getStatus() + " and can no longer be cancelled");
        }

        if (order.getPaymentState() == PaymentState.PAID && order.getPaymentId() != null) {
            refund(order);
        }

        order.setStatus(OrderStatus.CANCELLED);
        order.setCancellationReason(reason == null || reason.isBlank()
                ? "Cancelled by customer" : reason);
        Order saved = orderRepository.save(order);
        log.info("Order {} cancelled: {}", saved.getId(), saved.getCancellationReason());
        return toResponse(saved);
    }

    private void refund(Order order) {
        try {
            PaymentDto refunded = paymentClient.refundPayment(order.getPaymentId(),
                    RefundRequestDto.builder()
                            .reason("Order " + order.getId() + " cancelled")
                            .build());
            order.setPaymentState(toPaymentState(refunded.getPaymentStatus()));
            log.info("Order {} refunded via payment {}", order.getId(), refunded.getId());
        } catch (FeignException ex) {
            throw new RemoteServiceException("Refund failed for order " + order.getId()
                    + ": " + extractMessage(ex, ex.getMessage()), ex);
        }
    }

    // ------------------------------------------------------------------
    // Remote lookups
    // ------------------------------------------------------------------

    private RestaurantDto fetchRestaurant(Long restaurantId) {
        try {
            return restaurantClient.getRestaurant(restaurantId);
        } catch (FeignException.NotFound ex) {
            throw new ResourceNotFoundException("Restaurant not found with id: " + restaurantId);
        } catch (FeignException ex) {
            throw new RemoteServiceException(
                    "Restaurant service is unavailable: " + ex.getMessage(), ex);
        }
    }

    private List<MenuItemDto> fetchMenu(Long restaurantId) {
        try {
            return restaurantClient.getMenu(restaurantId);
        } catch (FeignException.NotFound ex) {
            throw new ResourceNotFoundException("Restaurant not found with id: " + restaurantId);
        } catch (FeignException ex) {
            throw new RemoteServiceException(
                    "Restaurant service is unavailable: " + ex.getMessage(), ex);
        }
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    BigDecimal deliveryFeeFor(BigDecimal subtotal) {
        if (subtotal.compareTo(freeDeliveryThreshold) >= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return deliveryFee.setScale(2, RoundingMode.HALF_UP);
    }

    private PaymentState toPaymentState(String paymentServiceStatus) {
        if (paymentServiceStatus == null) {
            return PaymentState.PENDING;
        }
        return switch (paymentServiceStatus.toUpperCase()) {
            case "SUCCESS" -> PaymentState.PAID;
            case "FAILED" -> PaymentState.FAILED;
            case "REFUNDED" -> PaymentState.REFUNDED;
            default -> PaymentState.PENDING;
        };
    }

    private String extractMessage(FeignException ex, String fallback) {
        try {
            String body = ex.contentUTF8();
            if (body == null || body.isBlank()) {
                return fallback;
            }
            JsonNode node = objectMapper.readTree(body);
            JsonNode message = node.get("message");
            return message == null || message.isNull() ? fallback : message.asText();
        } catch (Exception parseFailure) {
            return fallback;
        }
    }

    private void assertVisible(Order order, Long requesterId, String role) {
        if (STAFF_ROLES.contains(role)) {
            return;
        }
        if (requesterId != null && requesterId.equals(order.getCustomerId())) {
            return;
        }
        throw new AccessDeniedException("You are not allowed to access order " + order.getId());
    }

    private void assertStaffOrSelf(Long customerId, Long requesterId, String role) {
        if (STAFF_ROLES.contains(role)) {
            return;
        }
        if (requesterId == null || !requesterId.equals(customerId)) {
            throw new AccessDeniedException("You can only list your own orders");
        }
    }

    Order getOrderEntity(Long id) {
        return orderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + id));
    }

    private OrderResponse toResponse(Order o) {
        return OrderResponse.builder()
                .id(o.getId())
                .customerId(o.getCustomerId())
                .customerEmail(o.getCustomerEmail())
                .customerName(o.getCustomerName())
                .restaurantId(o.getRestaurantId())
                .restaurantName(o.getRestaurantName())
                .deliveryAddress(o.getDeliveryAddress())
                .notes(o.getNotes())
                .status(o.getStatus())
                .paymentState(o.getPaymentState())
                .paymentMethod(o.getPaymentMethod())
                .paymentId(o.getPaymentId())
                .transactionId(o.getTransactionId())
                .deliveryAgentId(o.getDeliveryAgentId())
                .deliveryAgentName(o.getDeliveryAgentName())
                .subtotal(o.getSubtotal())
                .deliveryFee(o.getDeliveryFee())
                .totalAmount(o.getTotalAmount())
                .cancellationReason(o.getCancellationReason())
                .items(o.getItems().stream().map(this::toItemResponse).toList())
                .createdAt(o.getCreatedAt())
                .updatedAt(o.getUpdatedAt())
                .build();
    }

    private OrderItemResponse toItemResponse(OrderItem i) {
        return OrderItemResponse.builder()
                .id(i.getId())
                .menuItemId(i.getMenuItemId())
                .itemName(i.getItemName())
                .unitPrice(i.getUnitPrice())
                .quantity(i.getQuantity())
                .specialInstructions(i.getSpecialInstructions())
                .lineTotal(i.getLineTotal())
                .build();
    }
}

package com.cravedash.order.service;

import com.cravedash.order.client.PaymentClient;
import com.cravedash.order.client.RestaurantClient;
import com.cravedash.order.client.dto.MenuItemDto;
import com.cravedash.order.client.dto.PaymentDto;
import com.cravedash.order.client.dto.RefundRequestDto;
import com.cravedash.order.client.dto.RestaurantDto;
import com.cravedash.order.dto.CreateOrderRequest;
import com.cravedash.order.dto.OrderItemRequest;
import com.cravedash.order.dto.OrderResponse;
import com.cravedash.order.dto.OrderStatsResponse;
import com.cravedash.order.entity.Order;
import com.cravedash.order.entity.OrderStatus;
import com.cravedash.order.entity.PaymentMethod;
import com.cravedash.order.entity.PaymentState;
import com.cravedash.order.exception.AccessDeniedException;
import com.cravedash.order.exception.InvalidOrderStateException;
import com.cravedash.order.exception.OrderItemUnavailableException;
import com.cravedash.order.exception.PaymentFailedException;
import com.cravedash.order.repository.OrderItemRepository;
import com.cravedash.order.repository.OrderRepository;
import feign.FeignException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private OrderItemRepository orderItemRepository;

    @Mock
    private RestaurantClient restaurantClient;

    @Mock
    private PaymentClient paymentClient;

    @InjectMocks
    private OrderService orderService;

    private RestaurantDto restaurant;
    private MenuItemDto pie;
    private MenuItemDto salad;
    private CreateOrderRequest request;

    @BeforeEach
    void setUp() {
        restaurant = RestaurantDto.builder()
                .id(1L)
                .name("The Copper Kettle")
                .active(true)
                .build();

        pie = MenuItemDto.builder()
                .id(10L)
                .restaurantId(1L)
                .name("Shepherd's Pie")
                .price(new BigDecimal("12.50"))
                .available(true)
                .build();

        salad = MenuItemDto.builder()
                .id(11L)
                .restaurantId(1L)
                .name("House Salad")
                .price(new BigDecimal("6.00"))
                .available(true)
                .build();

        request = CreateOrderRequest.builder()
                .restaurantId(1L)
                .customerName("Ada Lovelace")
                .deliveryAddress("12 Memory Lane")
                .paymentMethod(PaymentMethod.CARD)
                .items(List.of(
                        OrderItemRequest.builder().menuItemId(10L).quantity(1).build(),
                        OrderItemRequest.builder().menuItemId(11L).quantity(1).build()))
                .build();
    }

    private void stubSaveAssigningId() {
        when(orderRepository.save(any(Order.class))).thenAnswer(invocation -> {
            Order order = invocation.getArgument(0);
            if (order.getId() == null) {
                order.setId(101L);
            }
            return order;
        });
    }

    @Test
    void createOrder_pricesBasketAndCapturesPayment() {
        when(restaurantClient.getRestaurant(1L)).thenReturn(restaurant);
        when(restaurantClient.getMenu(1L)).thenReturn(List.of(pie, salad));
        stubSaveAssigningId();
        when(paymentClient.processPayment(any())).thenReturn(PaymentDto.builder()
                .id(500L)
                .orderId(101L)
                .customerId(7L)
                .amount(new BigDecimal("21.49"))
                .paymentStatus("SUCCESS")
                .transactionId("TXN-TEST-1")
                .build());

        OrderResponse response = orderService.createOrder(request, 7L, "ada@example.com");

        assertThat(response.getId()).isEqualTo(101L);
        assertThat(response.getRestaurantName()).isEqualTo("The Copper Kettle");
        assertThat(response.getSubtotal()).isEqualByComparingTo(new BigDecimal("18.50"));
        assertThat(response.getDeliveryFee()).isEqualByComparingTo(new BigDecimal("2.99"));
        assertThat(response.getTotalAmount()).isEqualByComparingTo(new BigDecimal("21.49"));
        assertThat(response.getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(response.getPaymentState()).isEqualTo(PaymentState.PAID);
        assertThat(response.getTransactionId()).isEqualTo("TXN-TEST-1");
        assertThat(response.getItems()).hasSize(2);
        assertThat(response.getItems().get(0).getLineTotal()).isEqualByComparingTo(new BigDecimal("12.50"));
    }

    @Test
    void createOrder_largeBasket_getsFreeDelivery() {
        when(restaurantClient.getRestaurant(1L)).thenReturn(restaurant);
        when(restaurantClient.getMenu(1L)).thenReturn(List.of(pie, salad));
        stubSaveAssigningId();
        when(paymentClient.processPayment(any())).thenReturn(PaymentDto.builder()
                .id(501L)
                .paymentStatus("SUCCESS")
                .transactionId("TXN-TEST-2")
                .build());

        CreateOrderRequest bigBasket = CreateOrderRequest.builder()
                .restaurantId(1L)
                .customerName("Ada Lovelace")
                .deliveryAddress("12 Memory Lane")
                .paymentMethod(PaymentMethod.UPI)
                .items(List.of(
                        OrderItemRequest.builder().menuItemId(10L).quantity(2).build(),
                        OrderItemRequest.builder().menuItemId(11L).quantity(1).build()))
                .build();

        OrderResponse response = orderService.createOrder(bigBasket, 7L, "ada@example.com");

        assertThat(response.getSubtotal()).isEqualByComparingTo(new BigDecimal("31.00"));
        assertThat(response.getDeliveryFee()).isEqualByComparingTo(new BigDecimal("0.00"));
        assertThat(response.getTotalAmount()).isEqualByComparingTo(new BigDecimal("31.00"));
    }

    @Test
    void createOrder_soldOutItem_throws() {
        when(restaurantClient.getRestaurant(1L)).thenReturn(restaurant);
        when(restaurantClient.getMenu(1L)).thenReturn(List.of(
                MenuItemDto.builder().id(10L).name("Shepherd's Pie")
                        .price(new BigDecimal("12.50")).available(false).build()));

        assertThatThrownBy(() -> orderService.createOrder(request, 7L, "ada@example.com"))
                .isInstanceOf(OrderItemUnavailableException.class)
                .hasMessageContaining("sold out");

        verify(orderRepository, never()).save(any());
    }

    @Test
    void createOrder_itemNotOnMenu_throws() {
        when(restaurantClient.getRestaurant(1L)).thenReturn(restaurant);
        when(restaurantClient.getMenu(1L)).thenReturn(List.of(pie));

        CreateOrderRequest ghostItem = CreateOrderRequest.builder()
                .restaurantId(1L)
                .customerName("Ada Lovelace")
                .deliveryAddress("12 Memory Lane")
                .paymentMethod(PaymentMethod.CARD)
                .items(List.of(OrderItemRequest.builder().menuItemId(999L).quantity(1).build()))
                .build();

        assertThatThrownBy(() -> orderService.createOrder(ghostItem, 7L, "ada@example.com"))
                .isInstanceOf(OrderItemUnavailableException.class)
                .hasMessageContaining("not on the menu");
    }

    @Test
    void createOrder_closedRestaurant_throws() {
        when(restaurantClient.getRestaurant(1L)).thenReturn(
                RestaurantDto.builder().id(1L).name("Shuttered Diner").active(false).build());

        assertThatThrownBy(() -> orderService.createOrder(request, 7L, "ada@example.com"))
                .isInstanceOf(OrderItemUnavailableException.class)
                .hasMessageContaining("not accepting orders");
    }

    @Test
    void createOrder_declinedPayment_cancelsOrderAndReportsReason() {
        when(restaurantClient.getRestaurant(1L)).thenReturn(restaurant);
        when(restaurantClient.getMenu(1L)).thenReturn(List.of(pie, salad));
        stubSaveAssigningId();

        FeignException declined = mock(FeignException.class);
        when(declined.status()).thenReturn(402);
        when(declined.contentUTF8()).thenReturn("{\"message\":\"Payment failed for order 101\"}");
        when(paymentClient.processPayment(any())).thenThrow(declined);

        assertThatThrownBy(() -> orderService.createOrder(request, 7L, "ada@example.com"))
                .isInstanceOf(PaymentFailedException.class)
                .hasMessageContaining("Payment failed for order 101");

        verify(orderRepository, times(2)).save(any(Order.class));
    }

    @Test
    void createOrder_anonymousCaller_throws() {
        assertThatThrownBy(() -> orderService.createOrder(request, null, null))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessageContaining("Sign in");
    }

    @Test
    void updateStatus_invalidTransition_throws() {
        when(orderRepository.findById(101L)).thenReturn(Optional.of(persistedOrder(OrderStatus.PENDING)));

        assertThatThrownBy(() -> orderService.updateStatus(101L, OrderStatus.DELIVERED, 1L, "kitchen", "RESTAURANT_ADMIN"))
                .isInstanceOf(InvalidOrderStateException.class)
                .hasMessageContaining("cannot move");
    }

    @Test
    void updateStatus_unpaidOrderIsBlocked() {
        Order unpaid = persistedOrder(OrderStatus.PENDING);
        unpaid.setPaymentState(PaymentState.FAILED);
        when(orderRepository.findById(101L)).thenReturn(Optional.of(unpaid));

        assertThatThrownBy(() -> orderService.updateStatus(101L, OrderStatus.CONFIRMED, 1L, "kitchen", "RESTAURANT_ADMIN"))
                .isInstanceOf(InvalidOrderStateException.class)
                .hasMessageContaining("no successful payment");
    }

    @Test
    void updateStatus_courierStartsDelivery_claimsOrder() {
        Order ready = persistedOrder(OrderStatus.READY_FOR_PICKUP);
        when(orderRepository.findById(101L)).thenReturn(Optional.of(ready));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));

        OrderResponse response = orderService.updateStatus(
                101L, OrderStatus.OUT_FOR_DELIVERY, 42L, "rider", "DELIVERY_AGENT");

        assertThat(response.getStatus()).isEqualTo(OrderStatus.OUT_FOR_DELIVERY);
        assertThat(response.getDeliveryAgentId()).isEqualTo(42L);
        assertThat(response.getDeliveryAgentName()).isEqualTo("rider");
    }

    @Test
    void claimOrder_rejectsAlreadyAssignedOrder() {
        Order claimed = persistedOrder(OrderStatus.READY_FOR_PICKUP);
        claimed.setDeliveryAgentId(9L);
        when(orderRepository.findById(101L)).thenReturn(Optional.of(claimed));

        assertThatThrownBy(() -> orderService.claimOrder(101L, 42L, "rider"))
                .isInstanceOf(InvalidOrderStateException.class)
                .hasMessageContaining("already assigned");
    }

    @Test
    void claimOrder_requiresReadyState() {
        when(orderRepository.findById(101L)).thenReturn(Optional.of(persistedOrder(OrderStatus.PREPARING)));

        assertThatThrownBy(() -> orderService.claimOrder(101L, 42L, "rider"))
                .isInstanceOf(InvalidOrderStateException.class)
                .hasMessageContaining("cannot be claimed");
    }

    @Test
    void cancelOrder_cancellableOrder_refunds() {
        Order pending = persistedOrder(OrderStatus.PENDING);
        when(orderRepository.findById(101L)).thenReturn(Optional.of(pending));
        when(orderRepository.save(any(Order.class))).thenAnswer(inv -> inv.getArgument(0));
        when(paymentClient.refundPayment(eq(500L), any(RefundRequestDto.class))).thenReturn(
                PaymentDto.builder().id(500L).paymentStatus("REFUNDED").build());

        OrderResponse response = orderService.cancelOrder(101L, "Changed my mind", 7L, "CUSTOMER");

        assertThat(response.getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(response.getPaymentState()).isEqualTo(PaymentState.REFUNDED);
        assertThat(response.getCancellationReason()).isEqualTo("Changed my mind");
    }

    @Test
    void cancelOrder_deliveredOrder_throws() {
        when(orderRepository.findById(101L)).thenReturn(Optional.of(persistedOrder(OrderStatus.DELIVERED)));

        assertThatThrownBy(() -> orderService.cancelOrder(101L, null, 7L, "CUSTOMER"))
                .isInstanceOf(InvalidOrderStateException.class)
                .hasMessageContaining("no longer be cancelled");
    }

    @Test
    void getOrder_otherCustomerForbidden() {
        when(orderRepository.findById(101L)).thenReturn(Optional.of(persistedOrder(OrderStatus.PENDING)));

        assertThatThrownBy(() -> orderService.getOrder(101L, 99L, "CUSTOMER"))
                .isInstanceOf(AccessDeniedException.class);

        OrderResponse asStaff = orderService.getOrder(101L, 99L, "ADMIN");
        assertThat(asStaff.getId()).isEqualTo(101L);
    }

    @Test
    void getOrder_unknownId_throws() {
        when(orderRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> orderService.getOrder(404L, 7L, "CUSTOMER"))
                .isInstanceOf(com.cravedash.order.exception.ResourceNotFoundException.class)
                .hasMessageContaining("Order not found");
    }

    @Test
    void getStats_aggregatesStatusesAndRevenue() {
        Order delivered = persistedOrder(OrderStatus.DELIVERED);
        Order cancelled = persistedOrder(OrderStatus.CANCELLED);
        Order ready = persistedOrder(OrderStatus.READY_FOR_PICKUP);
        when(orderRepository.findAll()).thenReturn(List.of(delivered, cancelled, ready));

        OrderStatsResponse stats = orderService.getStats();

        assertThat(stats.getTotalOrders()).isEqualTo(3);
        assertThat(stats.getDelivered()).isEqualTo(1);
        assertThat(stats.getCancelled()).isEqualTo(1);
        assertThat(stats.getAwaitingCourier()).isEqualTo(1);
        assertThat(stats.getCapturedRevenue()).isEqualByComparingTo(new BigDecimal("21.49"));
    }

    @Test
    void deliveryFeeFor_respectsThresholds() {
        assertThat(orderService.deliveryFeeFor(new BigDecimal("5.00")))
                .isEqualByComparingTo(new BigDecimal("2.99"));
        assertThat(orderService.deliveryFeeFor(new BigDecimal("30.00")))
                .isEqualByComparingTo(new BigDecimal("0.00"));
    }

    @Test
    void getUnassignedReadyOrders_delegatesToRepository() {
        when(orderRepository.findByStatusAndDeliveryAgentIdIsNullOrderByCreatedAtAsc(OrderStatus.READY_FOR_PICKUP))
                .thenReturn(List.of(persistedOrder(OrderStatus.READY_FOR_PICKUP)));

        assertThat(orderService.getUnassignedReadyOrders()).hasSize(1);
        verify(orderRepository, never()).findAllByOrderByCreatedAtDesc();
        verify(orderRepository, never()).findByCustomerIdOrderByCreatedAtDesc(anyLong());
    }

    private Order persistedOrder(OrderStatus status) {
        Order order = Order.builder()
                .id(101L)
                .customerId(7L)
                .customerEmail("ada@example.com")
                .customerName("Ada Lovelace")
                .restaurantId(1L)
                .restaurantName("The Copper Kettle")
                .deliveryAddress("12 Memory Lane")
                .paymentMethod(PaymentMethod.CARD)
                .status(status)
                .paymentState(PaymentState.PAID)
                .paymentId(500L)
                .transactionId("TXN-TEST-1")
                .subtotal(new BigDecimal("18.50"))
                .deliveryFee(new BigDecimal("2.99"))
                .totalAmount(new BigDecimal("21.49"))
                .build();
        order.addItem(com.cravedash.order.entity.OrderItem.builder()
                .id(1L)
                .menuItemId(10L)
                .itemName("Shepherd's Pie")
                .unitPrice(new BigDecimal("12.50"))
                .quantity(1)
                .lineTotal(new BigDecimal("12.50"))
                .build());
        return order;
    }
}

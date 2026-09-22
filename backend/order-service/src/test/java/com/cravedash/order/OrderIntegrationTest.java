package com.cravedash.order;

import com.cravedash.order.client.PaymentClient;
import com.cravedash.order.client.RestaurantClient;
import com.cravedash.order.client.dto.MenuItemDto;
import com.cravedash.order.client.dto.PaymentDto;
import com.cravedash.order.client.dto.PaymentRequestDto;
import com.cravedash.order.client.dto.RefundRequestDto;
import com.cravedash.order.client.dto.RestaurantDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end HTTP test of the order flow. The two downstream services are
 * replaced by mocks so the test runs without Eureka or PostgreSQL.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class OrderIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private RestaurantClient restaurantClient;

    @MockBean
    private PaymentClient paymentClient;

    @BeforeEach
    void stubDownstreamServices() {
        when(restaurantClient.getRestaurant(1L)).thenReturn(RestaurantDto.builder()
                .id(1L)
                .name("The Copper Kettle")
                .address("4 Lantern Way")
                .active(true)
                .build());

        when(restaurantClient.getMenu(1L)).thenReturn(List.of(
                MenuItemDto.builder().id(10L).restaurantId(1L).name("Shepherd's Pie")
                        .price(new BigDecimal("12.50")).available(true).build(),
                MenuItemDto.builder().id(11L).restaurantId(1L).name("House Salad")
                        .price(new BigDecimal("6.00")).available(true).build(),
                MenuItemDto.builder().id(12L).restaurantId(1L).name("Sold Out Tart")
                        .price(new BigDecimal("4.00")).available(false).build()));

        when(paymentClient.processPayment(any(PaymentRequestDto.class))).thenReturn(PaymentDto.builder()
                .id(500L)
                .customerId(7L)
                .amount(new BigDecimal("21.49"))
                .paymentMethod("CARD")
                .paymentStatus("SUCCESS")
                .transactionId("TXN-INTEGRATION")
                .build());

        when(paymentClient.refundPayment(any(), any(RefundRequestDto.class))).thenReturn(PaymentDto.builder()
                .id(500L)
                .paymentStatus("REFUNDED")
                .build());
    }

    private static final String ORDER_BODY = """
            {
              "restaurantId": 1,
              "customerName": "Ada Lovelace",
              "deliveryAddress": "12 Memory Lane",
              "notes": "Ring the bell twice",
              "paymentMethod": "CARD",
              "items": [
                { "menuItemId": 10, "quantity": 1, "specialInstructions": "Extra gravy" },
                { "menuItemId": 11, "quantity": 1 }
              ]
            }
            """;

    private long placeOrder() throws Exception {
        String created = mockMvc.perform(post("/api/orders")
                        .header("X-User-Id", 7)
                        .header("X-User-Email", "ada@example.com")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(ORDER_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.paymentState").value("PAID"))
                .andExpect(jsonPath("$.subtotal").value(18.50))
                .andExpect(jsonPath("$.deliveryFee").value(2.99))
                .andExpect(jsonPath("$.totalAmount").value(21.49))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.transactionId").value("TXN-INTEGRATION"))
                .andReturn().getResponse().getContentAsString();

        return ((Number) com.jayway.jsonpath.JsonPath.read(created, "$.id")).longValue();
    }

    @Test
    void placeAndTrackOrderThroughItsLifecycle() throws Exception {
        long orderId = placeOrder();

        mockMvc.perform(get("/api/orders/mine").header("X-User-Id", 7))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(orderId));

        mockMvc.perform(get("/api/orders/" + orderId)
                        .header("X-User-Id", 7)
                        .header("X-User-Role", "CUSTOMER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.restaurantName").value("The Copper Kettle"));

        mockMvc.perform(patch("/api/orders/" + orderId + "/status")
                        .header("X-User-Id", 2)
                        .header("X-User-Email", "kitchen@kettle.test")
                        .header("X-User-Role", "RESTAURANT_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"status\": \"CONFIRMED\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"));

        mockMvc.perform(patch("/api/orders/" + orderId + "/status")
                        .header("X-User-Role", "RESTAURANT_ADMIN")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"status\": \"DELIVERED\" }"))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/orders/restaurant/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(orderId));

        mockMvc.perform(get("/api/orders/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalOrders").value(1))
                .andExpect(jsonPath("$.capturedRevenue").value(21.49));
    }

    @Test
    void courierClaimsReadyOrderAndDelivers() throws Exception {
        long orderId = placeOrder();

        for (String status : List.of("CONFIRMED", "PREPARING", "READY_FOR_PICKUP")) {
            mockMvc.perform(patch("/api/orders/" + orderId + "/status")
                            .header("X-User-Role", "RESTAURANT_ADMIN")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{ \"status\": \"" + status + "\" }"))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/orders/agent/available"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(orderId));

        mockMvc.perform(post("/api/orders/" + orderId + "/claim")
                        .header("X-User-Id", 42)
                        .header("X-User-Email", "rider@cravedash.test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveryAgentId").value(42));

        mockMvc.perform(post("/api/orders/" + orderId + "/claim")
                        .header("X-User-Id", 43)
                        .header("X-User-Email", "rider2@cravedash.test"))
                .andExpect(status().isConflict());

        mockMvc.perform(patch("/api/orders/" + orderId + "/status")
                        .header("X-User-Id", 42)
                        .header("X-User-Role", "DELIVERY_AGENT")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"status\": \"OUT_FOR_DELIVERY\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OUT_FOR_DELIVERY"));

        mockMvc.perform(patch("/api/orders/" + orderId + "/status")
                        .header("X-User-Id", 42)
                        .header("X-User-Role", "DELIVERY_AGENT")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"status\": \"DELIVERED\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DELIVERED"));

        mockMvc.perform(get("/api/orders/agent/mine").header("X-User-Id", 42))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("DELIVERED"));
    }

    @Test
    void cancellableOrderIsRefunded() throws Exception {
        long orderId = placeOrder();

        mockMvc.perform(post("/api/orders/" + orderId + "/cancel")
                        .header("X-User-Id", 7)
                        .header("X-User-Role", "CUSTOMER")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"reason\": \"Ordered by mistake\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.paymentState").value("REFUNDED"))
                .andExpect(jsonPath("$.cancellationReason").value("Ordered by mistake"));
    }

    @Test
    void soldOutMenuItemIsRejected() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .header("X-User-Id", 7)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "restaurantId": 1,
                                  "customerName": "Ada Lovelace",
                                  "deliveryAddress": "12 Memory Lane",
                                  "paymentMethod": "CARD",
                                  "items": [ { "menuItemId": 12, "quantity": 1 } ]
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(
                        org.hamcrest.Matchers.containsString("sold out")));
    }

    @Test
    void anonymousCallerCannotReadSomeoneElsesOrder() throws Exception {
        long orderId = placeOrder();

        mockMvc.perform(get("/api/orders/" + orderId))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/orders/" + orderId)
                        .header("X-User-Id", 8)
                        .header("X-User-Role", "CUSTOMER"))
                .andExpect(status().isForbidden());
    }

    @Test
    void validationAndMissingOrderAreReported() throws Exception {
        mockMvc.perform(post("/api/orders")
                        .header("X-User-Id", 7)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "restaurantId": 1,
                                  "customerName": "Ada",
                                  "deliveryAddress": "",
                                  "paymentMethod": "CARD",
                                  "items": []
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isMap());

        mockMvc.perform(get("/api/orders/9999")
                        .header("X-User-Id", 7)
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isNotFound());
    }

    @Test
    void itemsEndpointReturnsKitchenLineItems() throws Exception {
        long orderId = placeOrder();

        mockMvc.perform(get("/api/orders/" + orderId + "/items")
                        .header("X-User-Id", 7)
                        .header("X-User-Role", "CUSTOMER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].itemName").value("Shepherd's Pie"))
                .andExpect(jsonPath("$[0].specialInstructions").value("Extra gravy"));
    }
}

package com.cravedash.payment.service;

import com.cravedash.payment.dto.PaymentRequest;
import com.cravedash.payment.dto.PaymentResponse;
import com.cravedash.payment.entity.Payment;
import com.cravedash.payment.entity.PaymentMethod;
import com.cravedash.payment.entity.PaymentStatus;
import com.cravedash.payment.exception.DuplicatePaymentException;
import com.cravedash.payment.exception.InvalidRefundException;
import com.cravedash.payment.exception.PaymentException;
import com.cravedash.payment.exception.ResourceNotFoundException;
import com.cravedash.payment.repository.PaymentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @InjectMocks
    private PaymentService paymentService;

    private PaymentRequest request;

    @BeforeEach
    void setUp() throws Exception {
        // Success rate 100 => deterministic approval in tests.
        Field rate = PaymentService.class.getDeclaredField("successRate");
        rate.setAccessible(true);
        rate.set(paymentService, 100);

        request = PaymentRequest.builder()
                .orderId(1L)
                .customerId(5L)
                .amount(new BigDecimal("42.50"))
                .paymentMethod(PaymentMethod.CARD)
                .build();
    }

    @Test
    void processPayment_success_setsTransactionId() {
        when(paymentRepository.existsByOrderId(1L)).thenReturn(false);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> {
            Payment p = inv.getArgument(0);
            if (p.getId() == null) p.setId(100L);
            return p;
        });

        PaymentResponse response = paymentService.processPayment(request);

        assertThat(response.getPaymentStatus()).isEqualTo(PaymentStatus.SUCCESS);
        assertThat(response.getTransactionId()).startsWith("TXN-");
        assertThat(response.getAmount()).isEqualByComparingTo(new BigDecimal("42.50"));
    }

    @Test
    void processPayment_duplicateOrder_throws() {
        when(paymentRepository.existsByOrderId(1L)).thenReturn(true);

        assertThatThrownBy(() -> paymentService.processPayment(request))
                .isInstanceOf(DuplicatePaymentException.class)
                .hasMessageContaining("already exists");

        verify(paymentRepository, never()).save(any());
    }

    @Test
    void refundPayment_successStatus_refunds() {
        Payment payment = Payment.builder()
                .id(100L)
                .orderId(1L)
                .customerId(5L)
                .amount(new BigDecimal("42.50"))
                .paymentMethod(PaymentMethod.CARD)
                .paymentStatus(PaymentStatus.SUCCESS)
                .transactionId("TXN-2024-ABCD")
                .build();
        when(paymentRepository.findById(100L)).thenReturn(Optional.of(payment));
        when(paymentRepository.save(any(Payment.class))).thenReturn(payment);

        PaymentResponse response = paymentService.refundPayment(100L, "Customer changed their mind");

        assertThat(response.getPaymentStatus()).isEqualTo(PaymentStatus.REFUNDED);
    }

    @Test
    void refundPayment_pendingStatus_throws() {
        Payment payment = Payment.builder()
                .id(101L)
                .orderId(2L)
                .customerId(5L)
                .amount(new BigDecimal("10.00"))
                .paymentMethod(PaymentMethod.CASH)
                .paymentStatus(PaymentStatus.PENDING)
                .build();
        when(paymentRepository.findById(101L)).thenReturn(Optional.of(payment));

        assertThatThrownBy(() -> paymentService.refundPayment(101L, null))
                .isInstanceOf(InvalidRefundException.class)
                .hasMessageContaining("Only SUCCESS payments");
    }

    @Test
    void getPayment_unknownId_throws() {
        when(paymentRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> paymentService.getPayment(404L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Payment not found");
    }

    @Test
    void processPayment_lowSuccessRate_canFail() throws Exception {
        Field rate = PaymentService.class.getDeclaredField("successRate");
        rate.setAccessible(true);
        rate.set(paymentService, 0);

        when(paymentRepository.existsByOrderId(1L)).thenReturn(false);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        assertThatThrownBy(() -> paymentService.processPayment(request))
                .isInstanceOf(PaymentException.class)
                .hasMessageContaining("Payment failed");
    }

    @Test
    void unusedHelpers_exist() {
        ReflectionTestUtils.setField(paymentService, "successRate", 100);
        assertThat(PaymentService.normalizeAmount(new BigDecimal("42.5")))
                .isEqualByComparingTo(new BigDecimal("42.50"));
        assertThat(paymentService.acceptsMethod(PaymentMethod.UPI)).isTrue();
    }
}

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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;

    @Value("${payment.simulation.success-rate:100}")
    private int successRate;

    private final SecureRandom random = new SecureRandom();

    @Transactional
    public PaymentResponse processPayment(PaymentRequest request) {
        if (paymentRepository.existsByOrderId(request.getOrderId())) {
            throw new DuplicatePaymentException(
                    "A payment already exists for order " + request.getOrderId());
        }

        Payment payment = Payment.builder()
                .orderId(request.getOrderId())
                .customerId(request.getCustomerId())
                .amount(request.getAmount())
                .paymentMethod(request.getPaymentMethod())
                .paymentStatus(PaymentStatus.PENDING)
                .build();

        payment = paymentRepository.save(payment);

        // Simulated payment gateway: approve or decline without touching a real provider.
        boolean approved = random.nextInt(100) < successRate;
        if (approved) {
            payment.setPaymentStatus(PaymentStatus.SUCCESS);
            payment.setTransactionId(generateTransactionId());
        } else {
            payment.setPaymentStatus(PaymentStatus.FAILED);
        }

        Payment saved = paymentRepository.save(payment);
        log.info("Payment {} for order {}: status={} tx={}",
                saved.getId(), saved.getOrderId(), saved.getPaymentStatus(), saved.getTransactionId());

        if (saved.getPaymentStatus() == PaymentStatus.FAILED) {
            throw new PaymentException("Payment failed for order " + request.getOrderId()
                    + ". Please try again with a different payment method.");
        }

        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPayment(Long id) {
        return toResponse(getPaymentEntity(id));
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByOrder(Long orderId) {
        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found for order: " + orderId));
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> getPaymentsByCustomer(Long customerId) {
        return paymentRepository.findByCustomerId(customerId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PaymentResponse> getAllPayments() {
        return paymentRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public PaymentResponse refundPayment(Long id, String reason) {
        Payment payment = getPaymentEntity(id);

        if (payment.getPaymentStatus() != PaymentStatus.SUCCESS) {
            throw new InvalidRefundException("Only SUCCESS payments can be refunded. Current status: "
                    + payment.getPaymentStatus());
        }

        payment.setPaymentStatus(PaymentStatus.REFUNDED);
        if (reason != null && !reason.isBlank()) {
            log.info("Refunding payment {} for order {}: {}", payment.getId(), payment.getOrderId(), reason);
        }
        return toResponse(paymentRepository.save(payment));
    }

    private Payment getPaymentEntity(Long id) {
        return paymentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Payment not found with id: " + id));
    }

    private String generateTransactionId() {
        byte[] bytes = new byte[12];
        random.nextBytes(bytes);
        return "TXN-" + LocalDateTime.now().toLocalDate() + "-" + HexFormat.of().formatHex(bytes).toUpperCase();
    }

    private PaymentResponse toResponse(Payment p) {
        return PaymentResponse.builder()
                .id(p.getId())
                .orderId(p.getOrderId())
                .customerId(p.getCustomerId())
                .amount(p.getAmount())
                .paymentMethod(p.getPaymentMethod())
                .paymentStatus(p.getPaymentStatus())
                .transactionId(p.getTransactionId())
                .createdAt(p.getCreatedAt())
                .build();
    }

    // Kept for tests that want deterministic gateway behavior.
    void setSuccessRateForTesting(int rate) {
        this.successRate = rate;
    }

    static BigDecimal normalizeAmount(BigDecimal amount) {
        return amount.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    boolean acceptsMethod(PaymentMethod method) {
        return method == PaymentMethod.CARD || method == PaymentMethod.UPI || method == PaymentMethod.CASH;
    }
}

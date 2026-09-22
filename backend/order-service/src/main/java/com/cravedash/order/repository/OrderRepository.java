package com.cravedash.order.repository;

import com.cravedash.order.entity.Order;
import com.cravedash.order.entity.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    List<Order> findByRestaurantIdOrderByCreatedAtDesc(Long restaurantId);

    List<Order> findByStatusOrderByCreatedAtAsc(OrderStatus status);

    List<Order> findAllByOrderByCreatedAtDesc();

    List<Order> findByDeliveryAgentIdOrderByCreatedAtDesc(Long deliveryAgentId);

    List<Order> findByStatusAndDeliveryAgentIdIsNullOrderByCreatedAtAsc(OrderStatus status);

    long countByCustomerId(Long customerId);

    long countByRestaurantId(Long restaurantId);
}

package com.cravedash.order.client;

import com.cravedash.order.client.dto.MenuItemDto;
import com.cravedash.order.client.dto.RestaurantDto;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.List;

/**
 * Talks to restaurant-service. The name is the Eureka application id, so the
 * actual host/port is resolved through service discovery + load balancing.
 */
@FeignClient(name = "RESTAURANT-SERVICE")
public interface RestaurantClient {

    @GetMapping("/api/restaurants/{id}")
    RestaurantDto getRestaurant(@PathVariable("id") Long id);

    @GetMapping("/api/restaurants/{restaurantId}/menu")
    List<MenuItemDto> getMenu(@PathVariable("restaurantId") Long restaurantId);
}

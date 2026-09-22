package com.cravedash.restaurant.service;

import com.cravedash.restaurant.dto.MenuItemRequest;
import com.cravedash.restaurant.dto.MenuItemResponse;
import com.cravedash.restaurant.dto.RestaurantRequest;
import com.cravedash.restaurant.dto.RestaurantResponse;
import com.cravedash.restaurant.entity.MenuItem;
import com.cravedash.restaurant.entity.Restaurant;
import com.cravedash.restaurant.exception.ResourceNotFoundException;
import com.cravedash.restaurant.repository.MenuItemRepository;
import com.cravedash.restaurant.repository.RestaurantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RestaurantServiceTest {

    @Mock
    private RestaurantRepository restaurantRepository;

    @Mock
    private MenuItemRepository menuItemRepository;

    @InjectMocks
    private RestaurantService restaurantService;

    private Restaurant restaurant;
    private RestaurantRequest restaurantRequest;

    @BeforeEach
    void setUp() {
        restaurant = Restaurant.builder()
                .id(1L)
                .name("The Gilded Spoon")
                .description("Classic fare, done properly.")
                .address("12 Memory Lane")
                .phone("555-0102")
                .email("hello@gildedspoon.test")
                .imageUrl("https://images.test/gilded.png")
                .active(true)
                .createdAt(LocalDateTime.now())
                .build();

        restaurantRequest = RestaurantRequest.builder()
                .name("The Gilded Spoon")
                .description("Classic fare, done properly.")
                .address("12 Memory Lane")
                .phone("555-0102")
                .email("hello@gildedspoon.test")
                .imageUrl("https://images.test/gilded.png")
                .active(true)
                .build();
    }

    @Test
    void createRestaurant_savesAndReturnsResponse() {
        when(restaurantRepository.save(any(Restaurant.class))).thenReturn(restaurant);

        RestaurantResponse response = restaurantService.createRestaurant(restaurantRequest, "owner@test.io");

        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getName()).isEqualTo("The Gilded Spoon");
        assertThat(response.getActive()).isTrue();
        verify(restaurantRepository).save(any(Restaurant.class));
    }

    @Test
    void getRestaurant_unknownId_throws() {
        when(restaurantRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> restaurantService.getRestaurant(99L))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Restaurant not found");
    }

    @Test
    void updateRestaurant_updatesFields() {
        when(restaurantRepository.findById(1L)).thenReturn(Optional.of(restaurant));
        when(restaurantRepository.save(any(Restaurant.class))).thenReturn(restaurant);

        RestaurantResponse response = restaurantService.updateRestaurant(1L, RestaurantRequest.builder()
                .name("The Gilded Fork")
                .description("Updated description")
                .address("99 New Street")
                .phone("555-0199")
                .email("new@gildedspoon.test")
                .imageUrl("https://images.test/gilded2.png")
                .active(false)
                .build());

        assertThat(response.getName()).isEqualTo("The Gilded Fork");
        assertThat(response.getActive()).isFalse();
    }

    @Test
    void deleteRestaurant_removesMenuAndRestaurant() {
        when(restaurantRepository.findById(1L)).thenReturn(Optional.of(restaurant));
        when(menuItemRepository.findByRestaurantId(1L)).thenReturn(List.of());

        restaurantService.deleteRestaurant(1L);

        verify(menuItemRepository).deleteAll(any());
        verify(restaurantRepository).delete(restaurant);
    }

    @Test
    void addMenuItem_belongsToRestaurant() {
        when(restaurantRepository.findById(1L)).thenReturn(Optional.of(restaurant));
        when(menuItemRepository.save(any(MenuItem.class))).thenAnswer(inv -> {
            MenuItem m = inv.getArgument(0);
            m.setId(10L);
            return m;
        });

        MenuItemResponse response = restaurantService.addMenuItem(1L, MenuItemRequest.builder()
                .name("Shepherd's Pie")
                .description("A proper pie")
                .price(new BigDecimal("12.50"))
                .category("Mains")
                .available(true)
                .build());

        assertThat(response.getId()).isEqualTo(10L);
        assertThat(response.getRestaurantId()).isEqualTo(1L);
        assertThat(response.getPrice()).isEqualByComparingTo(new BigDecimal("12.50"));
    }

    @Test
    void updateAvailability_togglesFlag() {
        MenuItem item = MenuItem.builder()
                .id(10L)
                .restaurantId(1L)
                .name("Shepherd's Pie")
                .price(new BigDecimal("12.50"))
                .available(true)
                .build();
        when(menuItemRepository.findById(10L)).thenReturn(Optional.of(item));
        when(menuItemRepository.save(any(MenuItem.class))).thenReturn(item);

        MenuItemResponse response = restaurantService.updateAvailability(
                1L, 10L, new com.cravedash.restaurant.dto.AvailabilityRequest(false));

        assertThat(response.getAvailable()).isFalse();
    }

    @Test
    void updateAvailability_wrongRestaurant_throws() {
        MenuItem item = MenuItem.builder()
                .id(10L)
                .restaurantId(2L)
                .name("Not mine")
                .price(new BigDecimal("5.00"))
                .available(true)
                .build();
        when(menuItemRepository.findById(10L)).thenReturn(Optional.of(item));

        assertThatThrownBy(() -> restaurantService.updateAvailability(
                1L, 10L, new com.cravedash.restaurant.dto.AvailabilityRequest(false)))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("does not belong");
    }
}

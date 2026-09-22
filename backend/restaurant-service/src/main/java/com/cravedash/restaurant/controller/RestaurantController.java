package com.cravedash.restaurant.controller;

import com.cravedash.restaurant.dto.AvailabilityRequest;
import com.cravedash.restaurant.dto.MenuItemRequest;
import com.cravedash.restaurant.dto.MenuItemResponse;
import com.cravedash.restaurant.dto.RestaurantRequest;
import com.cravedash.restaurant.dto.RestaurantResponse;
import com.cravedash.restaurant.service.RestaurantService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants")
@RequiredArgsConstructor
public class RestaurantController {

    private final RestaurantService restaurantService;

    @GetMapping
    public ResponseEntity<List<RestaurantResponse>> getAllRestaurants(
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(restaurantService.getAllRestaurants(search));
    }

    /** Kitchens owned by the signed-in restaurant admin (X-User-Email from the gateway). */
    @GetMapping("/mine")
    public ResponseEntity<List<RestaurantResponse>> getMyRestaurants(
            @RequestHeader(value = "X-User-Email", required = false) String ownerEmail) {
        return ResponseEntity.ok(restaurantService.getRestaurantsByOwner(ownerEmail));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RestaurantResponse> getRestaurant(@PathVariable Long id) {
        return ResponseEntity.ok(restaurantService.getRestaurant(id));
    }

    @PostMapping
    public ResponseEntity<RestaurantResponse> createRestaurant(
            @Valid @RequestBody RestaurantRequest request,
            @RequestHeader(value = "X-User-Email", required = false) String ownerEmail) {
        RestaurantResponse created = restaurantService.createRestaurant(request, ownerEmail);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<RestaurantResponse> updateRestaurant(
            @PathVariable Long id,
            @Valid @RequestBody RestaurantRequest request) {
        return ResponseEntity.ok(restaurantService.updateRestaurant(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRestaurant(@PathVariable Long id) {
        restaurantService.deleteRestaurant(id);
        return ResponseEntity.noContent().build();
    }

    // ---------- Menu ----------

    @GetMapping("/{restaurantId}/menu")
    public ResponseEntity<List<MenuItemResponse>> getMenu(
            @PathVariable Long restaurantId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(restaurantService.getMenu(restaurantId, search, category));
    }

    @PostMapping("/{restaurantId}/menu")
    public ResponseEntity<MenuItemResponse> addMenuItem(
            @PathVariable Long restaurantId,
            @Valid @RequestBody MenuItemRequest request) {
        MenuItemResponse created = restaurantService.addMenuItem(restaurantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{restaurantId}/menu/{itemId}")
    public ResponseEntity<MenuItemResponse> updateMenuItem(
            @PathVariable Long restaurantId,
            @PathVariable Long itemId,
            @Valid @RequestBody MenuItemRequest request) {
        return ResponseEntity.ok(restaurantService.updateMenuItem(restaurantId, itemId, request));
    }

    @DeleteMapping("/{restaurantId}/menu/{itemId}")
    public ResponseEntity<Void> deleteMenuItem(
            @PathVariable Long restaurantId,
            @PathVariable Long itemId) {
        restaurantService.deleteMenuItem(restaurantId, itemId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{restaurantId}/menu/{itemId}/availability")
    public ResponseEntity<MenuItemResponse> updateAvailability(
            @PathVariable Long restaurantId,
            @PathVariable Long itemId,
            @Valid @RequestBody AvailabilityRequest request) {
        return ResponseEntity.ok(restaurantService.updateAvailability(restaurantId, itemId, request));
    }
}

package com.cravedash.restaurant.service;

import com.cravedash.restaurant.dto.AvailabilityRequest;
import com.cravedash.restaurant.dto.MenuItemRequest;
import com.cravedash.restaurant.dto.MenuItemResponse;
import com.cravedash.restaurant.dto.RestaurantRequest;
import com.cravedash.restaurant.dto.RestaurantResponse;
import com.cravedash.restaurant.entity.MenuItem;
import com.cravedash.restaurant.entity.Restaurant;
import com.cravedash.restaurant.exception.ResourceNotFoundException;
import com.cravedash.restaurant.repository.MenuItemRepository;
import com.cravedash.restaurant.repository.RestaurantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RestaurantService {

    private final RestaurantRepository restaurantRepository;
    private final MenuItemRepository menuItemRepository;

    // ---------- Restaurants ----------

    @Transactional
    public RestaurantResponse createRestaurant(RestaurantRequest request, String ownerEmail) {
        Restaurant restaurant = Restaurant.builder()
                .name(request.getName())
                .description(request.getDescription())
                .address(request.getAddress())
                .phone(request.getPhone())
                .email(request.getEmail())
                .ownerEmail(ownerEmail)
                .imageUrl(request.getImageUrl())
                .active(request.getActive() == null ? Boolean.TRUE : request.getActive())
                .build();
        Restaurant saved = restaurantRepository.save(restaurant);
        log.info("Created restaurant id={} name={} owner={}", saved.getId(), saved.getName(), ownerEmail);
        return toResponse(saved);
    }

    @Transactional
    public RestaurantResponse updateRestaurant(Long id, RestaurantRequest request) {
        Restaurant restaurant = getRestaurantEntity(id);
        restaurant.setName(request.getName());
        restaurant.setDescription(request.getDescription());
        restaurant.setAddress(request.getAddress());
        restaurant.setPhone(request.getPhone());
        restaurant.setEmail(request.getEmail());
        restaurant.setImageUrl(request.getImageUrl());
        if (request.getActive() != null) {
            restaurant.setActive(request.getActive());
        }
        return toResponse(restaurantRepository.save(restaurant));
    }

    @Transactional
    public void deleteRestaurant(Long id) {
        Restaurant restaurant = getRestaurantEntity(id);
        menuItemRepository.deleteAll(menuItemRepository.findByRestaurantId(id));
        restaurantRepository.delete(restaurant);
        log.info("Deleted restaurant id={}", id);
    }

    @Transactional(readOnly = true)
    public RestaurantResponse getRestaurant(Long id) {
        return toResponse(getRestaurantEntity(id));
    }

    @Transactional(readOnly = true)
    public List<RestaurantResponse> getAllRestaurants(String search) {
        List<Restaurant> restaurants = (search == null || search.isBlank())
                ? restaurantRepository.findByActiveTrue()
                : restaurantRepository.findByNameContainingIgnoreCaseAndActiveTrue(search);
        return restaurants.stream().map(this::toResponse).toList();
    }

    /** Listings published by the signed-in RESTAURANT_ADMIN (X-User-Email). */
    @Transactional(readOnly = true)
    public List<RestaurantResponse> getRestaurantsByOwner(String ownerEmail) {
        if (ownerEmail == null || ownerEmail.isBlank()) {
            return List.of();
        }
        return restaurantRepository.findByOwnerEmailIgnoreCase(ownerEmail)
                .stream().map(this::toResponse).toList();
    }

    // ---------- Menu items ----------

    @Transactional
    public MenuItemResponse addMenuItem(Long restaurantId, MenuItemRequest request) {
        Restaurant restaurant = getRestaurantEntity(restaurantId);
        MenuItem item = MenuItem.builder()
                .restaurantId(restaurant.getId())
                .name(request.getName())
                .description(request.getDescription())
                .price(request.getPrice())
                .category(request.getCategory())
                .imageUrl(request.getImageUrl())
                .available(request.getAvailable() == null ? Boolean.TRUE : request.getAvailable())
                .build();
        return toMenuItemResponse(menuItemRepository.save(item));
    }

    @Transactional
    public MenuItemResponse updateMenuItem(Long restaurantId, Long itemId, MenuItemRequest request) {
        MenuItem item = getMenuItemEntity(restaurantId, itemId);
        item.setName(request.getName());
        item.setDescription(request.getDescription());
        item.setPrice(request.getPrice());
        item.setCategory(request.getCategory());
        item.setImageUrl(request.getImageUrl());
        if (request.getAvailable() != null) {
            item.setAvailable(request.getAvailable());
        }
        return toMenuItemResponse(menuItemRepository.save(item));
    }

    @Transactional
    public void deleteMenuItem(Long restaurantId, Long itemId) {
        MenuItem item = getMenuItemEntity(restaurantId, itemId);
        menuItemRepository.delete(item);
    }

    @Transactional
    public MenuItemResponse updateAvailability(Long restaurantId, Long itemId, AvailabilityRequest request) {
        MenuItem item = getMenuItemEntity(restaurantId, itemId);
        item.setAvailable(request.getAvailable());
        return toMenuItemResponse(menuItemRepository.save(item));
    }

    @Transactional(readOnly = true)
    public List<MenuItemResponse> getMenu(Long restaurantId, String search, String category) {
        // Ensures a 404 when the restaurant does not exist, even if the menu is empty.
        getRestaurantEntity(restaurantId);

        List<MenuItem> items;
        if (search != null && !search.isBlank()) {
            items = menuItemRepository.findByRestaurantIdAndNameContainingIgnoreCase(restaurantId, search);
        } else if (category != null && !category.isBlank()) {
            items = menuItemRepository.findByRestaurantIdAndCategoryIgnoreCase(restaurantId, category);
        } else {
            items = menuItemRepository.findByRestaurantId(restaurantId);
        }
        return items.stream().map(this::toMenuItemResponse).toList();
    }

    @Transactional(readOnly = true)
    public MenuItem getMenuItemEntity(Long restaurantId, Long itemId) {
        MenuItem item = menuItemRepository.findById(itemId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Menu item not found with id: " + itemId));
        if (!item.getRestaurantId().equals(restaurantId)) {
            throw new ResourceNotFoundException(
                    "Menu item " + itemId + " does not belong to restaurant " + restaurantId);
        }
        return item;
    }

    private Restaurant getRestaurantEntity(Long id) {
        return restaurantRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurant not found with id: " + id));
    }

    private RestaurantResponse toResponse(Restaurant r) {
        return RestaurantResponse.builder()
                .id(r.getId())
                .name(r.getName())
                .description(r.getDescription())
                .address(r.getAddress())
                .phone(r.getPhone())
                .email(r.getEmail())
                .ownerEmail(r.getOwnerEmail())
                .imageUrl(r.getImageUrl())
                .active(r.getActive())
                .createdAt(r.getCreatedAt())
                .build();
    }

    private MenuItemResponse toMenuItemResponse(MenuItem m) {
        return MenuItemResponse.builder()
                .id(m.getId())
                .restaurantId(m.getRestaurantId())
                .name(m.getName())
                .description(m.getDescription())
                .price(m.getPrice())
                .category(m.getCategory())
                .imageUrl(m.getImageUrl())
                .available(m.getAvailable())
                .build();
    }
}

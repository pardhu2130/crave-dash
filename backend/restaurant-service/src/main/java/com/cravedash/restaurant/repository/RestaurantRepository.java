package com.cravedash.restaurant.repository;

import com.cravedash.restaurant.entity.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {

    List<Restaurant> findByActiveTrue();

    List<Restaurant> findByNameContainingIgnoreCaseAndActiveTrue(String name);

    List<Restaurant> findByOwnerEmailIgnoreCase(String ownerEmail);

    List<Restaurant> findByNameContainingIgnoreCase(String name);
}

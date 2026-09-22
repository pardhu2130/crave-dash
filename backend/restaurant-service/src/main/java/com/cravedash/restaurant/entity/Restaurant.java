package com.cravedash.restaurant.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "restaurants")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Restaurant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 500)
    private String description;

    @NotBlank
    @Column(nullable = false, length = 255)
    private String address;

    @Column(length = 20)
    private String phone;

    @Email
    @Column(length = 150)
    private String email;

    /**
     * Email of the RESTAURANT_ADMIN that published this listing. The gateway
     * forwards it as X-User-Email on the create call, and `/api/restaurants/mine`
     * filters on it.
     */
    @Column(name = "owner_email", length = 150)
    private String ownerEmail;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(nullable = false)
    private Boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (this.active == null) {
            this.active = true;
        }
        this.createdAt = LocalDateTime.now();
    }
}

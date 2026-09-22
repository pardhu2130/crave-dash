package com.cravedash.restaurant.dto;

import jakarta.validation.constraints.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RestaurantRequest {

    @NotBlank(message = "Restaurant name is required")
    @Size(min = 2, max = 120, message = "Restaurant name must be between 2 and 120 characters")
    private String name;

    @Size(max = 500, message = "Description must be at most 500 characters")
    private String description;

    @NotBlank(message = "Address is required")
    @Size(max = 255, message = "Address must be at most 255 characters")
    private String address;

    @Pattern(regexp = "^[0-9+\\-() ]{0,20}$", message = "Phone number is not valid")
    private String phone;

    @Email(message = "Email must be valid")
    private String email;

    @Size(max = 500, message = "Image URL must be at most 500 characters")
    private String imageUrl;

    private Boolean active;
}

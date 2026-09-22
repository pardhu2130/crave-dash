package com.cravedash.restaurant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class RestaurantIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void createGetAndDeleteRestaurant() throws Exception {
        String body = """
                {
                  "name": "The Copper Kettle",
                  "description": "Homely roasts and pies.",
                  "address": "4 Lantern Way",
                  "phone": "555-0110",
                  "email": "kettle@test.io"
                }
                """;

        String created = mockMvc.perform(post("/api/restaurants")
                        .header("X-User-Email", "owner@test.io")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name").value("The Copper Kettle"))
                .andReturn().getResponse().getContentAsString();

        com.jayway.jsonpath.JsonPath.parse(created);

        long id = ((Number) com.jayway.jsonpath.JsonPath.read(created, "$.id")).longValue();

        mockMvc.perform(get("/api/restaurants/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("The Copper Kettle"));

        mockMvc.perform(get("/api/restaurants?search=copper"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id));

        mockMvc.perform(delete("/api/restaurants/" + id))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/restaurants/" + id))
                .andExpect(status().isNotFound());
    }

    @Test
    void menuCrudLifecycle() throws Exception {
        String restaurantBody = """
                { "name": "Menu Test Bistro", "address": "7 Test Square" }
                """;
        String restaurant = mockMvc.perform(post("/api/restaurants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(restaurantBody))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        long restaurantId = ((Number) com.jayway.jsonpath.JsonPath.read(restaurant, "$.id")).longValue();

        String menuItem = mockMvc.perform(post("/api/restaurants/" + restaurantId + "/menu")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Beef Wellington",
                                  "description": "A showstopper",
                                  "price": 24.99,
                                  "category": "Mains"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.available").value(true))
                .andReturn().getResponse().getContentAsString();
        long itemId = ((Number) com.jayway.jsonpath.JsonPath.read(menuItem, "$.id")).longValue();

        mockMvc.perform(patch("/api/restaurants/" + restaurantId + "/menu/" + itemId + "/availability")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"available\": false }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false));

        mockMvc.perform(put("/api/restaurants/" + restaurantId + "/menu/" + itemId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Beef Wellington Royale",
                                  "price": 29.99,
                                  "category": "Mains"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Beef Wellington Royale"));

        mockMvc.perform(delete("/api/restaurants/" + restaurantId + "/menu/" + itemId))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/restaurants/" + restaurantId + "/menu"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void createRestaurant_validationError() throws Exception {
        mockMvc.perform(post("/api/restaurants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"name\": \"x\", \"address\": \"\" }"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isMap());
    }
}

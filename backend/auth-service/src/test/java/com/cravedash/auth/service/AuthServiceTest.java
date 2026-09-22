package com.cravedash.auth.service;

import com.cravedash.auth.dto.LoginRequest;
import com.cravedash.auth.dto.RegisterRequest;
import com.cravedash.auth.dto.UserResponse;
import com.cravedash.auth.entity.User;
import com.cravedash.auth.exception.EmailAlreadyExistsException;
import com.cravedash.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private com.cravedash.auth.security.JwtService jwtService;

    @InjectMocks
    private AuthService authService;

    private RegisterRequest registerRequest;
    private User user;

    @BeforeEach
    void setUp() {
        registerRequest = RegisterRequest.builder()
                .name("Ada Lovelace")
                .email("ada@example.com")
                .password("secret123")
                .phone("555-0100")
                .role(com.cravedash.auth.entity.Role.CUSTOMER)
                .build();

        user = User.builder()
                .id(1L)
                .name("Ada Lovelace")
                .email("ada@example.com")
                .password("hashed")
                .phone("555-0100")
                .role(com.cravedash.auth.entity.Role.CUSTOMER)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    void register_createsUserAndHashesPassword() {
        when(userRepository.existsByEmail("ada@example.com")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenReturn(user);
        when(jwtService.generateToken(any(User.class))).thenReturn("jwt-token");

        var response = authService.register(registerRequest);

        assertThat(response.getToken()).isEqualTo("jwt-token");
        assertThat(response.getRole()).isEqualTo("CUSTOMER");
        assertThat(response.getEmail()).isEqualTo("ada@example.com");
        verify(passwordEncoder).encode("secret123");
        verify(userRepository).save(any(User.class));
    }

    @Test
    void register_duplicateEmail_throws() {
        when(userRepository.existsByEmail("ada@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(registerRequest))
                .isInstanceOf(EmailAlreadyExistsException.class)
                .hasMessageContaining("already registered");

        verify(userRepository, never()).save(any());
    }

    @Test
    void login_validCredentials_returnsToken() {
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "hashed")).thenReturn(true);
        when(jwtService.generateToken(any(User.class))).thenReturn("jwt-token");

        var response = authService.login(LoginRequest.builder()
                .email("ada@example.com")
                .password("secret123")
                .build());

        assertThat(response.getToken()).isEqualTo("jwt-token");
        assertThat(response.getUserId()).isEqualTo(1L);
    }

    @Test
    void login_unknownEmail_throws() {
        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(LoginRequest.builder()
                .email("ghost@example.com")
                .password("whatever")
                .build()))
                .isInstanceOf(com.cravedash.auth.exception.InvalidCredentialsException.class)
                .hasMessageContaining("Invalid email or password");
    }

    @Test
    void login_wrongPassword_throws() {
        when(userRepository.findByEmail("ada@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("nope", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> authService.login(LoginRequest.builder()
                .email("ada@example.com")
                .password("nope")
                .build()))
                .isInstanceOf(com.cravedash.auth.exception.InvalidCredentialsException.class);
    }

    @Test
    void getUserById_mapsToResponse() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));

        UserResponse response = authService.getUserById(1L);

        assertThat(response.getId()).isEqualTo(1L);
        assertThat(response.getName()).isEqualTo("Ada Lovelace");
        assertThat(response.getRole()).isEqualTo("CUSTOMER");
        assertThat(response.getCreatedAt()).isNotNull();
    }
}

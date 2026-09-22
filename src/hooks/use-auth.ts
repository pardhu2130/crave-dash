/**
 * CraveDash authenticates against the Spring Boot auth-service (JWT), so this
 * hook is a thin re-export of the JWT session context. Keeping the original
 * import path means every existing caller — `RequireAuth` included — keeps
 * working unchanged.
 */
export { useAuth } from "@/context/AuthContext";

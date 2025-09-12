// Re-export auth components and hooks from the hooks directory
export { AuthProvider, useAuth, hasRole, isStoreStaff, isStoreAdmin, isPennyAdmin, isOffender } from "@/hooks/use-auth";
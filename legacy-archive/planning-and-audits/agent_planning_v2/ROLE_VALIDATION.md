# ROLE VALIDATION MATRIX

This matrix outlines every page and primary button/action in the application, validating whether the role-based access control (RBAC) works, fails, or is implemented poorly (e.g., hidden on the frontend but unprotected on the backend).

| Page | Action / Button | Intended Roles | Status | Failure Details / Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **LandingPage** | "Get Started" / "Sign In" | Public | **Works** | Fully public. |
| **LoginPage / SignUp** | Submission | Public | **Works** | Correctly redirects authenticated users. |
| **DashboardPage** | General Access | All | **Works** | Redirects to role-specific dashboard (Admin/Landlord/Tenant). |
| **AdminDashboardPage** | View System Metrics | Admin | **Poorly Done** | Route is accessible if URL is entered manually by a Landlord. Needs `<ProtectedRoute>` in React Router. |
| | Approve Users/Agents | Admin | **Works** | Backend checks `requireRole('admin')`. |
| **LandlordDashboardPage**| View Property List | Landlord, Admin | **Works** | Correctly fetches landlord's properties. |
| | "Add Property" | Landlord, Admin | **Poorly Done** | Hidden for Tenants, but a Tenant could potentially hit the API endpoint if they craft a POST request, as backend only checks auth, not role strictly on this specific route. |
| **AddPropertyPage** | Submit New Property | Landlord, Admin | **Halfway Done** | Backend creates it, but doesn't assign ownership securely based on the JWT token. Uses the payload `landlord_id` indiscriminately. |
| **PropertyDetailPage** | "Edit Property" | Owner, Admin | **Poorly Done** | Any landlord can edit any property if they know the ID. Backend lacks `if (property.ownerId !== req.user.id) return 403`. |
| | "Delete Property" | Owner, Admin | **Poorly Done** | Same as Edit. Major security vulnerability. |
| | "View Floor Plan" | All | **Works** | Read-only access is fine. |
| | "View 3D Splat" | All | **Works** | Read-only access is fine. |
| **TenantPortalPage** | "Pay Rent" | Tenant | **Halfway Done** | Button triggers MPesa, but anyone can trigger a payment for any unit. Needs backend validation `if (lease.tenantId !== req.user.id)`. |
| | "Submit Maintenance" | Tenant | **Works** | Ties to the currently logged-in user natively. |
| **AdminUserManagement**| "Delete User" | Admin | **Works** | Backend correctly enforces `requireRole('admin')`. |
| | "Edit Role" | Admin | **Works** | Enforced by Admin middleware. |

## Executive Summary
- **Frontend Defect:** We rely heavily on "Hiding Buttons" instead of Route Protection (`<ProtectedRoute>`).
- **Backend Defect:** We rely heavily on `requireAuth` but forget Resource-Level Authorization (checking if the `req.user.id` actually *owns* the resource they are trying to modify).

# Mutune Rent Pro: 3D & Motion Upgrade Design System

This document outlines the visual specifications, interactive prototypes, and motion principles for the upgraded **MutuneRent Pro** portal. These specifications are backed by award-winning web design patterns (GSAP + ScrollTrigger + Lenis) and 3D voxel rendering.

---

## 🎨 Brand Design Tokens

We use a premium, high-contrast dark mode palette with a royal purple primary brand accent and a sunset gold/orange secondary accent.

```oklch
/* Design Tokens (OKLCH Format for Gamut Precision) */
--background: oklch(14% 0.04 240);       /* Deep Navy Slate (#051424) */
--surface: oklch(21% 0.04 240);          /* Card Surface (#122131) */
--primary: oklch(81% 0.12 280);          /* Royal Lavender Primary (#CABEFF) */
--primary-container: oklch(42% 0.22 280);/* Rich Indigo Container (#5D3FD3) */
--secondary: oklch(82% 0.16 45);         /* Sunset Gold Secondary (#FFB68D) */
--secondary-container: oklch(50% 0.28 45);/* Burnt Orange Container (#AE4F00) */
```

- **Easing Curve:** `power3.inOut` (used globally for all micro-interactions, page wipes, and scroll interpolations).
- **Typography:** **Inter** for headlines and clean UI typography; **Geist Mono** for data cells and labels.

---

## 📱 Google Stitch Prototypes

We have generated high-fidelity prototype screens within Google Stitch (Project: `Mutune 3D Upgrade`). Click the screenshot resources below to inspect the visual layouts:

### 1. Unified Tenant & Admin Dashboard
*   **Prototype URL:** ![Dashboard Screenshot](https://lh3.googleusercontent.com/aida/AP1WRLvXaIu1DbbC7SrHfc9n8my_ZMfUim7N8VBn9nF_vST_YtqZEhyFNKuoy0VprH-m6Jl6JlzvwT7z3j70quGpMeQKe4Pi9z8Y0T2k0o9f8MVd1dsvnY1AtDJFFO6yZDu8Mm2_IOtImyjXALuJYo0n0FaAsCmRtBmX2lfWutML7H_7qtE1RBsQycpn0IPIH5yvi-981cXFQghqKEawFAxX4vco9icqrfVou_dqRfQ8OHsgTCpU-0Vbp9LboUs)
*   **Key Features:**
    *   **3D Voxel Property Viewer:** A real-time rendering of the residential block using Three.js/React-Three-Fiber, showing active occupancy states.
    *   **Financial & Occupancy Trends:** Interactive, high-contrast analytics widgets using secondary sunset orange gradients.
    *   **Glassmorphic Action Center:** High-performance quick action cards for listing inspections, lease requests, and check-ins.

### 2. Analytics Portal
*   **Prototype URL:** ![Analytics Screenshot](https://lh3.googleusercontent.com/aida/AP1WRLtIWOaU3-7QZ82RRcjuqDkF9nz9v3O4KrjLTGXsEPrCoePgc6W_rCX5levL6OYUsvUsrzEX_Mt0kgVZ6NmokmFglut4rx2DnEfp8c69tTuWa7hSWDuF2dRm9ivJjfsU4jIZ4m6HKspyt3KhAmtcxBQ6reZfALx7nQ1pXgiUZHlUazN-A0rYL4nOUYnysEpS2-scNwTHbAjD6JzCCzNOWKtrBslgJ9d3UAMQafHBvk14m2cq2CuNjYBNCbI)
*   **Key Features:**
    *   **Dynamic Revenue Charting:** Smooth area charts plotting monthly growth metrics.
    *   **Occupancy Gauge:** Vibrant ring gauges visualizing 94% portfolio health.
    *   **AI Portfolio Optimization Card:** Recommends dynamically calculated rent values.

### 3. Settings & Integrations Control
*   **Prototype URL:** ![Settings Screenshot](https://lh3.googleusercontent.com/aida/AP1WRLtzhIqB85-XWGdmuqlEbEAOiIzKjfpQ0AoLpJ3XdiY4QECqW-PWNqeZjCHCHJ1WBE4YhddDSOutGFFEu7TZQKSsI6TGRRdgNJNKjs8JLuPGkGqiviTp21S0s9ZO9QSR3vj8J1BldiPWYVcEhhQFFWwLqnCzrNs_5ScRVPymeS9CXua4hTjE6ezI_1AvvxIP9DZSIXw2i8DJpkd109iqgetwrGNrbL5MlGigHKN8oSy-mDuLuWUxP77awQ)
*   **Key Features:**
    *   **Team Permissions Grid:** Multi-tenant access controls and credential sections.
    *   **Custom OKLCH Accent Selectors:** Custom range and toggle controls.

### 4. User Profile & Listings
*   **Prototype URL:** ![Profile Screenshot](https://lh3.googleusercontent.com/aida/AP1WRLu76JSBJ30hNkUOT9hNrPwrvo6jGsgRTmSvoTcItW39RMeXDfTDq7pL3orbGFKyg9hmA05KZJ2DS1XLjJFqkWIPeKeZ0IAjZRJrkaAx1zkP1dJdKZBAj4JhsiC_UxBe8NiDX3K8Qo51Pi0UZMh-DrT0t90LYaM4wV-6x2vkr0sDzgtuZEcT8JYpbiftXkeg91yxfN711K7vWe-puI9rJrFt7KpOUw0RFW9Lc0yq0Xzjc_T-emjQgjvYoe8)
*   **Key Features:**
    *   **Verified Agent Badge:** Profile metrics overlaying active portfolio items.
    *   **Communication Logs:** Live chat feed with integrated task completion tracking.

---

## 🎥 Motion & 3D Implementation Mechanics

Following Awwwards-tier site principles, we will avoid performance-lag on mobile by structuring our 3D integrations as follows:

1.  **3D Scene Architecture:**
    *   Use **Spline** for the high-end visual properties and ambient lighting.
    *   Use **React-Three-Fiber** (`@react-three/fiber` + `@react-three/drei`) inside the Dashboard Hero for real-time interactivity.
    *   Implement a **Mobile Fallback** that renders an optimized flat SVG layout or high-quality pre-rendered WebP sequence if the screen width is `< 768px`.
2.  **Cinematic Intro Loader:**
    *   Add a custom `IntroLoader` displaying a `0` to `100` progress counter that finishes in exactly `1.8 seconds` (capping initial wait time).
    *   Trigger an SVG path drawing animation of the Mutune logo, followed by a double color wipe transition (royal purple sliding up, exposing the dark navy slate page).
3.  **Smooth Scrolling:**
    *   Wrap the application main router in **Lenis smooth scroll**.
    *   Hook Lenis into **GSAP ScrollTrigger** to drive stagger reveals of listings cards.

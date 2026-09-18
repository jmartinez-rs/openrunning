# Kinetic Volt Running Engine

## Design System Overview
El **Kinetic Volt Running Engine** es un sistema de diseño premium, enfocado en el alto rendimiento, orientado a interfaces modernas para corredores ("High-Contrast Sports Modernism"). Emplea un esquema "Dark Mode" inmersivo y componentes flotantes para dar la sensación de una consola de telemetría de carrera.

## Tokens Principales

### Colores
- **Backgrounds (Card / Surface):** Fondos oscuros (`#000000`, `#09090B`) con efectos de `backdrop-blur` (glassmorphism) e intensos bordes sutiles.
- **Primary / Hero:** El color insignia es **Kinetic Volt** (`#EAFC5F`), un verde/amarillo neón (chartreuse) usado para resaltar métricas, gráficas, y el botón principal "Hero Action".
- **Destructive:** Un rojo brillante (`#EF4444`) para métricas negativas o alertas de frecuencia cardíaca (FC Máx).
- **Muted:** Grises azulados para texto secundario (`#A1A1AA`, `#71717A`).

### Tipografía
- **Font Display:** `Space Grotesk`. Usada para números grandes, métricas, títulos principales y el reloj. Evoca tecnología y velocidad.
- **Font Sans:** `Plus Jakarta Sans`. Usada para texto de lectura, descripciones y componentes secundarios de la UI, con alta legibilidad.

### Estilo de Contenedores
- **Pill-shaped Containers:** Botones de navegación y tabs se diseñan como "píldoras" completamente redondeadas (`rounded-full`).
- **Floating Widgets:** Las tarjetas de métricas en la pantalla de Map Tracker flotan sobre el mapa con sombras (`shadow-card`) y desenfoque (`backdrop-blur-md`).
- **Glow Effects:** Los elementos interactivos principales (como el botón Play o las barras de progreso activas) proyectan un aura resplandeciente (`shadow-glow`).

## Estructura de Vistas (Phase 3)

### 1. Dashboard (Vista Principal)
- **Layout:** Mantiene su estructura en grilla, pero actualiza sus componentes al nuevo diseño "Dark Mode".
- **Tarjetas (VolumeCard, TargetRaceCard, etc):** Utilizan fondos translúcidos (`bg-card/90 backdrop-blur-md`), bordes sutiles (`border-white/5`) y sombras profundas (`shadow-card`).
- **Métricas:** Los números grandes emplean la tipografía `Space Grotesk` (`font-display`).
- **Acentos:** Se usa el color **Kinetic Volt** (`bg-primary`, `text-primary`) para barras de progreso, iconos destacados y estados activos, en lugar de los antiguos colores variados (teal, indigo, emerald).

### 2. Planes de Entrenamiento (Routines)
- **Active Plan Hero:** Tarjeta inmersiva superior con botones circulares "Pill" para cambiar de semana ("ESTA SEMANA", "SEMANA PASADA").
- **Métricas Visuales:** Barras de progreso de diseño estriado (`stripe-pattern`) y valores grandes con `Space Grotesk`.
- **Filtros:** Navegación por estados usando chips redondeados (`Activos`, `Planificados`).

### 3. Telemetría y Estadísticas (Analytics)
- **Layout:** Distribución en grid horizontal, con uso intensivo de `bg-card` y `border-border` en `ChartCards`.
- **Gráficas Resplandecientes:** Se emplean áreas y barras en `recharts` que respetan los colores de dominio de Kinetic Volt, destacando ritmos, kilómetros y sesiones sobre el fondo oscuro.

## Implementación Técnica
El sistema se implementa usando:
- **Tailwind CSS v4:** Manejo de variables semánticas (ej. `bg-primary`, `text-muted-foreground`).
- **Lucide Icons:** Íconos consistentes en toda la plataforma.
- **React Leaflet:** Base para la vista Full Bleed Map, con `TileLayer` apuntando a CARTO Dark.
- **Recharts:** Renderización de datos para la vista de Telemetría.

Este documento sirve como base de diseño y especificación técnica para cualquier vista o componente futuro de la aplicación OpenRunning.

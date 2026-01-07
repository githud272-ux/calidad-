# Sistema de Auditorías de Calidad - Ridery 2026

Sistema completo de gestión de auditorías de calidad para agentes, con gestión de equipos, métricas semanales y anuales.

## 🚀 Características

### ✨ Nuevo en 2026
- ✅ **Diseño Futurista 2026** - Interfaz moderna con colores corporativos Ridery
- ✅ **Gestión de Equipos** - Administra 5 equipos de soporte con integrantes dinámicos
- ✅ **Auditorías por Chat** - Todas las auditorías enfocadas en interacciones de chat
- ✅ **Filtros Avanzados** - Busca por equipo, mes, agente, o ticket
- ✅ **Top Agentes por Equipo** - Visualiza el mejor agente de cada equipo

### 📋 Características Base
- ✅ Autenticación basada en correo electrónico
- ✅ Sistema de roles (Editor y Lector)
- ✅ Gestión completa de auditorías (Crear, Editar, Eliminar)
- ✅ Métricas semanales y anuales con gráficos interactivos
- ✅ Dashboard con resumen de actividad
- ✅ Interfaz moderna y responsive
- ✅ Almacenamiento local persistente

## 👥 Equipos de Soporte

El sistema gestiona 5 equipos especializados:

1. **Soporte Usuarios** - Atención general a usuarios de la plataforma
2. **Soporte Conductores** - Asistencia especializada para conductores
3. **Soporte de ECR** - Equipo de casos especiales y resolución
4. **Soporte de Corporativo** - Atención a clientes corporativos
5. **Soporte de Delivery Zupper** - Soporte para servicio de delivery

Cada equipo tiene un color distintivo y puede gestionar sus propios integrantes.

## 👤 Roles

### Editor
- Correo: `editor@ridery.com`
- Permisos: Crear, editar y eliminar auditorías
- Gestionar integrantes de equipos (agregar/eliminar)
- Acceso completo a todas las funcionalidades

### Lector
- Correo: `lector@ridery.com`
- Permisos: Solo visualizar auditorías y métricas
- Ver equipos e integrantes
- Sin permisos de edición

## 📝 Estructura de Auditorías

Cada auditoría de chat incluye:

- **Agente**: Selección desde lista organizada por equipos
- **ID del Ticket**: Identificador único del ticket
- **Fecha del Ticket**: Cuando se creó el ticket
- **Fecha de Auditoría**: Cuando se realizó la auditoría
- **Tipificación**: Categoría de la consulta
- **Calificación**: Puntuación de 0-100
- **Resumen**: Descripción breve de la interacción
- **Observaciones**: Comentarios y áreas de mejora

## 🛠️ Tecnologías

- HTML5, CSS3, JavaScript (Vanilla)
- Chart.js para gráficos
- Font Awesome para iconos
- LocalStorage para persistencia de datos

## 📦 Instalación Local

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev

# La aplicación estará disponible en http://localhost:3000
```

## 🌐 Despliegue en Vercel

### Opción 1: Despliegue Automático (Recomendado)

El repositorio ya está configurado con un archivo `vercel.json` en la raíz que configura automáticamente el despliegue.

1. Conecta tu repositorio con Vercel
2. Vercel detectará automáticamente la configuración
3. Haz clic en "Deploy"

El archivo `vercel.json` en la raíz del repositorio maneja automáticamente:
- La ruta correcta al directorio de la aplicación
- Las rutas SPA para manejo de navegación
- Los headers de seguridad necesarios

### Opción 2: Configuración Manual

Si prefieres configurar manualmente:

1. Conecta tu repositorio con Vercel
2. Configura el proyecto con los siguientes ajustes:
   - **Framework Preset**: Other
   - **Root Directory**: `calidad--copilot-setup-auditoria-web-app/calidad-agentes-web`
   - **Build Command**: (dejar vacío o `npm install`)
   - **Output Directory**: `.` (punto)
   - **Install Command**: `npm install`
3. Despliega

⚠️ **NOTA**: El archivo `vercel.json` en la raíz del repositorio ya incluye toda la configuración necesaria, incluyendo rutas y headers de seguridad.

## 🔐 Seguridad

- Autenticación requerida antes de acceder al sistema
- Roles diferenciados con permisos específicos
- Headers de seguridad configurados en Vercel
- Validación de datos en formularios
- Sin vulnerabilidades detectadas por CodeQL

## 📊 Funcionalidades

### Dashboard
- Resumen rápido de auditorías totales, semanales y agentes
- Actividad reciente
- Top agentes por equipo con colores distintivos

### Gestión de Auditorías
- Lista completa de auditorías con filtros avanzados
- Búsqueda por agente, ticket o comentarios
- Filtrado por equipo y mes
- Formulario de creación/edición optimizado para chat
- Eliminación de auditorías (solo editores)

### Gestión de Equipos (Solo Editores)
- Visualización de 5 equipos de soporte
- Agregar integrantes con nombre y correo
- Eliminar integrantes cuando sea necesario
- Colores distintivos por equipo

### Métricas Semanales
- Gráfico de auditorías con selección de semanas específicas
- Semanas definidas de Lunes a Viernes con rangos de fechas
- Filtro por semanas desde Enero hasta la fecha actual
- Estadísticas de puntuación promedio
- Tabla de agentes evaluados en la semana seleccionada

### Métricas Anuales
- Gráfico mensual del año en curso
- Datos agregados desde métricas semanales
- Ranking de agentes por puntuación
- Indicadores de tendencia

## 🎨 Diseño Mejorado 2026

La interfaz ha sido completamente renovada con:

- **Paleta de Colores Moderna**: Gradientes vibrantes en tonos verde-azul en lugar del diseño básico blanco
- **Efectos Visuales Avanzados**: Sombras dinámicas, bordes con gradientes, y animaciones suaves
- **Tarjetas Mejoradas**: Cards con gradientes de fondo, bordes de colores y efectos hover
- **Navegación Actualizada**: Botones con estados activos en gradiente verde y efectos de elevación
- **Background Atractivo**: Fondo con gradiente azul-verde y patrón de cuadrícula sutil
- **Tablas Estilizadas**: Headers con fondo gradiente y efectos hover en las filas
- **Formularios Mejorados**: Inputs con bordes de color y efectos focus llamativos

## 🎨 Personalización

Los colores corporativos de Ridery se pueden modificar en `/assets/css/styles.css`:

```css
--ridery-mint: #38CEA6;
--ridery-cyan: #06b6d4;
--ridery-purple: #a855f7;
--ridery-accent: #0b8f6a;
--gradient-hero: linear-gradient(135deg, #0e4c3d, #1e6b5a, #38CEA6, #4dd4b1);
--surface: #fafbfc;
--surface-card: #ffffff;
```

## 🔮 Futuras Mejoras

- Sistema completo de evaluación por pilares (Empatía y Gestión)
- Métricas manuales semanales con campos personalizables
- Exportación de reportes
- Notificaciones automáticas
- Integración con sistemas externos

## 📝 Licencia

© 2026 Ridery Venezuela. Todos los derechos reservados.

# Sistema de Gestión - Tupak Rantina

Sistema de gestión financiera para la Caja de Ahorro y Crédito Tupak Rantina.

## Características

- **Autenticación**: Sistema de login con Supabase
- **Diseño Responsive**: Optimizado para móviles y desktop
- **Navegación por Pestañas**: Interfaz intuitiva con múltiples módulos
- **Branding Corporativo**: Colores y logos de Tupak Rantina

## Estructura del Proyecto

```
gestion/
├── index.html      # Página principal del sistema
├── login.html      # Página de inicio de sesión
├── main.js         # Lógica de autenticación y navegación
└── README.md       # Este archivo
```

## Módulos

### 1. Cuentas
**Estado**: En desarrollo  
**Descripción**: Módulo para gestión de cuentas financieras

### 2. Pagarés
**Estado**: En desarrollo  
**Descripción**: Módulo para gestión de pagarés

## Paleta de Colores

El sistema utiliza una paleta de colores diferente al "Centro de Herramientas" para evitar confusiones:

- **Gradiente Principal**: Azul oscuro (#1e3a8a) a Púrpura (#7c3aed)
- **Colores Corporativos**:
  - Azul oscuro: `#001749`
  - Naranja: `#e48410`
  - Azul claro: `#3787c6`
  - Azul acento: `#015cd0`
- **Colores de Acento**:
  - Púrpura: `#7c3aed`
  - Púrpura oscuro: `#6d28d9`

## Tecnologías

- **Frontend**: HTML5, Tailwind CSS, JavaScript
- **Backend/Auth**: Supabase
- **Iconos**: Font Awesome 6
- **Fuentes**: Inter (Google Fonts)

## Uso

1. Acceder a `login.html` para iniciar sesión
2. Credenciales válidas redirigen a `index.html`
3. Navegar entre módulos usando las pestañas

## Responsive Design

- **Desktop**: Navegación por pestañas horizontal
- **Móvil**: Menú hamburguesa con navegación vertical
- **Touch Targets**: Mínimo 44px para mejor usabilidad móvil

## Autenticación

El sistema utiliza Supabase para:
- Gestión de sesiones
- Autenticación de usuarios
- Persistencia de sesión
- Auto-refresh de tokens

## Próximos Pasos

- [ ] Implementar módulo de Cuentas
- [ ] Implementar módulo de Pagarés
- [ ] Agregar más funcionalidades según requerimientos

## Versión

**v1.0.0** - Sistema base con estructura y autenticación

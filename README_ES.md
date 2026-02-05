# SecureMint Engine

<div align="center">

<img src="assets/logo.svg" alt="Logo de SecureMint Engine" width="640">

**Protocolo empresarial de acuñación segura con control de oráculos para tokens respaldados**

[![Auditoría de Seguridad](https://img.shields.io/badge/Seguridad-Auditado-green.svg)](#auditoría-de-seguridad)
[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue.svg)](https://soliditylang.org/)

[English Version](README.md) | **Versión en Español**

</div>

---

## Tabla de Contenidos

- [Descripción General](#descripción-general)
- [Fundamentos Matemáticos y Modelo Económico](#fundamentos-matemáticos-y-modelo-económico)
- [Arquitectura](#arquitectura)
- [Invariantes Fundamentales](#invariantes-fundamentales)
- [Auditoría de Seguridad](#auditoría-de-seguridad)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Inicio Rápido](#inicio-rápido)
- [Contratos Inteligentes](#contratos-inteligentes)
- [Puerta de Enlace API](#puerta-de-enlace-api)
- [Uso del SDK](#uso-del-sdk)
- [Motor de Pruebas Retrospectivas](#motor-de-pruebas-retrospectivas)
- [Pruebas](#pruebas)
- [Despliegue](#despliegue)
- [Licencia y Divulgaciones de Terceros](#licencia-y-divulgaciones-de-terceros)
- [Contribuciones](#contribuciones)
- [Contacto](#contacto)

---

## Descripción General

**SecureMint Engine** es un protocolo empresarial de acuñación segura con control de oráculos, diseñado para crear tokens respaldados incluyendo monedas estables, tokens respaldados por activos y tokens de Activos del Mundo Real (RWA, por sus siglas en inglés). En su núcleo, el protocolo impone un invariante fundamental e innegociable: los tokens SOLO pueden acuñarse cuando el respaldo es demostrablemente suficiente a través de oráculos en cadena o feeds de Prueba de Reservas. Esta aplicación criptográfica elimina los supuestos de confianza que han llevado a fallos catastróficos en el ecosistema de monedas estables y tokens respaldados.

### El Problema que Resolvemos

La historia de los tokens respaldados está plagada de fallos enraizados en una única vulnerabilidad: **acuñación discrecional sin respaldo verificable**. Desde monedas estables algorítmicas que colapsaron bajo condiciones de corrida bancaria hasta tokens respaldados por activos donde las reservas existían solo en papel, el hilo común es siempre el mismo—la capacidad de crear tokens sin prueba criptográfica de que existe el respaldo correspondiente.

Los sistemas de tokens tradicionales dependen de la confianza. Los usuarios confían en que cuando un protocolo afirma "respaldo 1:1" o "totalmente colateralizado", las reservas realmente existen. Confían en que la acuñación se controla responsablemente. Confían en que las atestaciones de terceros son precisas y oportunas. Este modelo basado en la confianza ha fallado repetidamente:

- **Terra/LUNA (2022)**: $40 mil millones se evaporaron cuando el respaldo algorítmico resultó insuficiente bajo estrés
- **FTX/Alameda**: Los depósitos de clientes que respaldaban tokens FTT fueron secretamente agotados
- **Numerosos proyectos pequeños**: Prometieron reservas que nunca fueron verificadas, llevando a la insolvencia

SecureMint Engine elimina la confianza de la ecuación. Cada operación de acuñación requiere prueba criptográfica—entregada a través de oráculos en cadena o feeds de Prueba de Reservas—de que el respaldo existe y es suficiente. Sin prueba significa sin acuñación. Punto.

### Filosofía Central: Sigue el Dinero

> Cada token en circulación DEBE tener una prueba verificable en cadena de su respaldo.
> **Sin prueba de respaldo = Sin acuñación.**

Esta filosofía, que llamamos la "Doctrina de Seguir el Dinero", no es simplemente un principio de diseño—es una restricción inmutable aplicada a nivel de contrato inteligente. El Contrato de Política SecureMint actúa como un guardián automatizado que verifica matemáticamente el respaldo antes de que cualquier operación de acuñación pueda ejecutarse. La discreción humana se elimina del camino crítico. Las llaves administrativas no pueden anular los requisitos de respaldo. No hay funciones de acuñación de emergencia que eludan la verificación.

### Cómo Funciona

SecureMint Engine implementa una arquitectura multicapa que separa las responsabilidades mientras mantiene una seguridad inquebrantable:

**1. La Capa de Token (BackedToken.sol)**

El contrato del token en sí es intencionalmente "tonto". Implementa el estándar ERC-20 con una modificación crítica: la función `mint()` SOLO puede ser llamada por el Contrato de Política SecureMint. Ninguna llave de administrador, ningún multisig, ningún voto de gobernanza puede acuñar tokens directamente. Esta decisión arquitectónica significa que incluso si todos los demás componentes del sistema fueran comprometidos, no se podrían crear tokens sin respaldo.

**2. La Capa de Política (SecureMintPolicy.sol)**

Este es el cerebro del sistema. Cuando llega una solicitud de acuñación, el Contrato de Política ejecuta una serie de verificaciones obligatorias:

- **Verificación de Salud del Oráculo**: ¿Está respondiendo el oráculo de precio/reserva? ¿Son los datos frescos (menos de 1 hora de antigüedad)? ¿Hay desviación sospechosa de los valores recientes?
- **Verificación de Respaldo**: ¿Después de esta acuñación, seguirá el suministro total siendo menor o igual al respaldo verificado? Esta verificación usa datos de oráculo en tiempo real, no valores en caché o desactualizados.
- **Limitación de Tasa**: ¿Esta acuñación excede el límite por época? ¿Excede el límite global de suministro?
- **Estado del Sistema**: ¿Está el sistema pausado debido a una emergencia? ¿Están todos los interruptores de circuito en estado normal?

Si CUALQUIER verificación falla, la transacción revierte. No hay advertencias, no hay opciones de anulación, no hay bypass de administrador. La acuñación simplemente no puede ocurrir.

**3. La Capa de Oráculo (BackingOraclePoR.sol)**

La capa de oráculo agrega datos de múltiples fuentes para determinar el respaldo verificado. Para colateral en cadena, esto significa consultar feeds de precios y calcular el valor del colateral. Para reservas fuera de cadena (como depósitos bancarios que respaldan una moneda estable colateralizada por fiat), esto significa consumir feeds de Prueba de Reservas de proveedores como Chainlink.

La capa de oráculo implementa verificaciones de obsolescencia (rechazando datos más antiguos que el umbral configurado), límites de desviación (señalando movimientos de precios sospechosos), y agregación de múltiples fuentes (requiriendo consenso entre múltiples proveedores de oráculos). Si los oráculos difieren significativamente o se desconectan, la acuñación se pausa automáticamente.

**4. La Capa de Tesorería (TreasuryVault.sol)**

Las reservas se gestionan a través de un sistema de cuatro niveles diseñado para equilibrar la accesibilidad con la seguridad:

- **Nivel 0 (Caliente)**: 5-10% de las reservas para redenciones inmediatas, mantenido en activos líquidos en cadena
- **Nivel 1 (Tibio)**: 15-25% accesible en horas, típicamente en protocolos de mercado monetario
- **Nivel 2 (Frío)**: 50-60% en custodia segura, accesible en días
- **Nivel 3 (RWA)**: 10-20% en activos del mundo real como letras del Tesoro, accesible en días a semanas

Este enfoque escalonado asegura que la demanda normal de redención pueda satisfacerse instantáneamente mientras protege la mayoría de las reservas del riesgo de contratos inteligentes.

**5. La Capa de Gobernanza**

Mientras que la acuñación está completamente automatizada y no puede ser anulada, los parámetros del protocolo pueden ajustarse a través de la gobernanza. Sin embargo, todos los cambios de parámetros fluyen a través de un contrato Timelock, proporcionando un retraso obligatorio (típicamente 48-72 horas) durante el cual la comunidad puede revisar los cambios y, si es necesario, salir del sistema. Las acciones de emergencia requieren aprobación del multisig de Guardianes y están limitadas a medidas protectoras (pausar, no acuñar).

### Los Cuatro Invariantes

SecureMint Engine impone cuatro invariantes fundamentales que son continuamente monitoreados y automáticamente aplicados:

**INV-SM-1: El Respaldo Siempre Cubre el Suministro**
```
respaldo(t) >= suministroTotal(t) para todo tiempo t
```
En ningún momento el suministro total de tokens puede exceder el respaldo verificado. Esto se verifica antes de cada acuñación y se monitorea continuamente.

**INV-SM-2: Salud del Oráculo Requerida**
```
mint() revierte si oráculo_saludable == falso
```
La acuñación es imposible sin datos de oráculo frescos y válidos. Datos obsoletos, oráculos que no responden, o desviaciones sospechosas activan el rechazo automático.

**INV-SM-3: La Acuñación está Limitada**
```
acuñado(época) <= límite_época AND suministroTotal <= límite_global
```
Incluso con respaldo suficiente, la acuñación está limitada en tasa para prevenir una expansión rápida del suministro que podría desestabilizar los mercados.

**INV-SM-4: Sin Camino de Bypass**
```
∀ contratos, roles: mint() solo callable via SecureMintPolicy
```
No existe ninguna función, rol o contrato que pueda acuñar tokens excepto a través del camino verificado del Contrato de Política.

### Por Qué Esto Importa

Las implicaciones de la aplicación criptográfica del respaldo se extienden más allá de la seguridad técnica:

**Para Usuarios**: Ya no necesitas confiar en atestaciones, auditores o equipos de protocolo. La blockchain misma impone los requisitos de respaldo. Si los tokens existen, el respaldo existe—matemáticamente garantizado.

**Para Reguladores**: La Prueba de Reservas se vuelve en tiempo real y verificable, no un PDF trimestral. Los reguladores pueden verificar independientemente el respaldo en cualquier altura de bloque.

**Para Instituciones**: El riesgo de exposición a reserva fraccionaria se elimina. La integración con tokens SecureMint no requiere suposiciones de confianza sobre la solvencia del emisor.

**Para el Ecosistema**: Los fallos de tokens respaldados han dañado repetidamente la confianza en el ecosistema cripto más amplio. Los tokens demostrablemente respaldados reconstruyen esa confianza sobre fundamentos criptográficos.

### Arquitectura Lista para Producción

SecureMint Engine no es una prueba de concepto. Es infraestructura de producción diseñada para despliegue institucional:

- **8 Contratos Inteligentes Probados en Batalla** implementando el ciclo de vida completo del token
- **SDK en TypeScript** con hooks de React para integración frontend
- **Subgraph de The Graph** para datos de blockchain indexados y consultables
- **Puerta de Enlace API REST/GraphQL** para integración de sistemas fuera de cadena
- **Suite Completa de Pruebas** incluyendo pruebas unitarias, de integración, fuzzing y verificación formal
- **Marco de Auditoría de Seguridad** con pruebas de regresión que previenen la reintroducción de vulnerabilidades
- **Motor de Pruebas Retrospectivas** simulando comportamiento del protocolo bajo condiciones de estrés (corridas bancarias, fallos de oráculos, caídas del mercado)
- **Pipeline CI/CD** con puertas de seguridad que bloquean el despliegue ante cualquier hallazgo

### Quién Debería Usar SecureMint Engine

SecureMint Engine está diseñado para:

- **Emisores de Monedas Estables** construyendo monedas estables respaldadas por fiat, colateralizadas por cripto, o híbridas
- **Proyectos de Tokenización de RWA** trayendo activos del mundo real a la cadena con respaldo verificable
- **Emisores Institucionales de Tokens** que requieren verificación de respaldo de grado regulatorio
- **Protocolos DeFi** construyendo sistemas de préstamo, empréstito o trading que necesitan activos demostrablemente respaldados
- **Investigación de Moneda Digital de Banco Central (CBDC)** explorando la aplicación criptográfica del respaldo

Si tu token reclama respaldo—ya sea de reservas fiat, colateral cripto, bienes raíces, commodities, o cualquier otro activo—SecureMint Engine asegura que ese reclamo sea criptográficamente verificable y automáticamente aplicado.

### El Futuro de los Tokens Respaldados

La era del respaldo basado en confianza está terminando. Usuarios, reguladores e instituciones demandan cada vez más prueba verificable en lugar de atestaciones y promesas. SecureMint Engine representa el estándar arquitectónico para esta nueva era: respaldo que es probado, no prometido; aplicación que es criptográfica, no discrecional; y seguridad que está garantizada por matemáticas, no por confianza.

Bienvenido al futuro de los tokens respaldados. Bienvenido a SecureMint Engine.

---

## Fundamentos Matemáticos y Modelo Económico

SecureMint Engine está construido sobre fundamentos matemáticos rigurosos que aseguran seguridad criptográfica y estabilidad económica. Esta sección documenta las ecuaciones fundamentales, modelos y gráficos que sustentan el protocolo.

### Ecuaciones de Invariantes Fundamentales

#### Invariante Fundamental de Respaldo (INV-SM-1)

La restricción de seguridad primaria que asegura que los tokens siempre están completamente respaldados:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ∀t : R(t) ≥ S(t)                                                          ║
║                                                                              ║
║   donde:                                                                     ║
║     R(t) = Valor total de respaldo verificado en tiempo t (moneda base)     ║
║     S(t) = Suministro total de tokens en tiempo t                           ║
║                                                                              ║
║   Forma expandida:                                                           ║
║                                                                              ║
║   R(t) = Σᵢ[Rᵢ(t) × Pᵢ(t)] + PoR(t)                                        ║
║                                                                              ║
║   donde:                                                                     ║
║     Rᵢ(t)  = Cantidad de reserva del activo i en tiempo t                   ║
║     Pᵢ(t)  = Precio del oráculo del activo i en tiempo t                    ║
║     PoR(t) = Atestación de Prueba de Reservas para activos fuera de cadena  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### Ratio de Colateralización

```
                    R(t)
    RC(t) = ─────────────────  × 100%
                    S(t)

    Restricciones:
    ┌─────────────────────────────────────────────────────────┐
    │  RC(t) ≥ 100%     →  Acuñación PERMITIDA                │
    │  RC(t) < 100%     →  Acuñación BLOQUEADA, Sistema PAUSA │
    │  RC(t) ≥ 150%     →  Sobre-colateralización saludable   │
    └─────────────────────────────────────────────────────────┘
```

#### Función de Autorización de Acuñación

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   puedeAcuñar(cantidad, destinatario) → booleano                            ║
║                                                                              ║
║   = oráculo_saludable(t)                                                     ║
║     ∧ (S(t) + cantidad ≤ R(t))                                              ║
║     ∧ (acuñado_época(e) + cantidad ≤ límite_época)                          ║
║     ∧ (S(t) + cantidad ≤ límite_global)                                     ║
║     ∧ ¬estáPausado                                                           ║
║     ∧ tieneRol(msg.sender, ROL_ACUÑADOR)                                    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### Funciones de Salud del Oráculo

#### Verificación de Obsolescencia (INV-SM-2)

```
    oráculo_saludable(t) = (t - t_última_actualización) < UMBRAL_OBSOLESCENCIA

    donde:
      t                      = Marca de tiempo actual
      t_última_actualización = Última marca de tiempo de actualización del oráculo
      UMBRAL_OBSOLESCENCIA   = 3600 segundos (1 hora)

    ┌──────────────────────────────────────────────────────────────────────┐
    │  LÍNEA DE TIEMPO DE OBSOLESCENCIA DEL ORÁCULO                        │
    │                                                                      │
    │  Fresco        Zona de Advertencia    Obsoleto (BLOQUEADO)           │
    │    ◄─────────────►◄───────────────►◄───────────────────►             │
    │    0            45min            1hr                                 │
    │    │              │               │                                  │
    │    ●──────────────●───────────────●────────────────────►  tiempo     │
    │  actualizar    advertencia     rechazar                              │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

#### Detección de Desviación de Precio

```
    desviación(P_nuevo, P_viejo) = |P_nuevo - P_viejo| / P_viejo × 100%

    ┌───────────────────────────────────────────────────────────────┐
    │  Desviación < 5%   →  ACEPTAR                                 │
    │  5% ≤ Desviación < 10%  →  ACEPTAR con bandera ADVERTENCIA    │
    │  Desviación ≥ 10%  →  RECHAZAR (requiere consenso multi-oráculo)│
    └───────────────────────────────────────────────────────────────┘
```

#### Agregación Multi-Oráculo

```
    P_agregado = mediana(P₁, P₂, ..., Pₙ)

    Requisito de consenso:

    ∀i,j : |Pᵢ - Pⱼ| / max(Pᵢ, Pⱼ) < DESVIACIÓN_MÁX (5%)

    Si el consenso falla → Sistema entra en modo DEGRADADO → Acuñación PAUSADA
```

### Ecuaciones de Limitación de Tasa (INV-SM-3)

#### Limitación de Tasa Basada en Épocas

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   época(t) = ⌊t / DURACIÓN_ÉPOCA⌋                                           ║
║                                                                              ║
║   acuñado_época(e) = Σ cantidad_acuñada durante época e                     ║
║                                                                              ║
║   Verificación de límite de tasa:                                            ║
║   acuñado_época(época_actual) + cantidad ≤ LÍMITE_ÉPOCA                     ║
║                                                                              ║
║   Parámetros por defecto:                                                    ║
║     DURACIÓN_ÉPOCA = 86400 segundos (24 horas)                              ║
║     LÍMITE_ÉPOCA = 5% del suministro total                                  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### Retroceso Exponencial para Acuñaciones Fallidas

```
    tiempo_espera(n) = min(RETRASO_BASE × 2ⁿ, RETRASO_MÁX)

    donde:
      n            = Número de intentos fallidos consecutivos
      RETRASO_BASE = 1 segundo
      RETRASO_MÁX  = 3600 segundos (1 hora)

    ┌──────────────────────────────────────────────────────────────────────┐
    │  CURVA DE RETROCESO                                                  │
    │                                                                      │
    │  espera(s)│                                    ┌───────────────       │
    │    3600   │                                    │                      │
    │           │                              ┌─────┘                      │
    │    1800   │                        ┌─────┘                            │
    │           │                  ┌─────┘                                  │
    │     900   │            ┌─────┘                                        │
    │           │      ┌─────┘                                              │
    │     450   │ ┌────┘                                                    │
    │           │─┘                                                         │
    │       1   └──────────────────────────────────────────────► intentos  │
    │           1    2    3    4    5    6    7    8    9   10              │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

### Modelo de Reservas de Tesorería

#### Asignación de Reservas de Cuatro Niveles

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     ESTRUCTURA DE NIVELES DE RESERVA                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   Reservas Totales = Nivel₀ + Nivel₁ + Nivel₂ + Nivel₃                      ║
║                                                                              ║
║   ┌────────┬───────────┬─────────────┬───────────────────────────────────┐  ║
║   │ Nivel  │ Asignación│ Tiempo Acc. │ Tipos de Activos                  │  ║
║   ├────────┼───────────┼─────────────┼───────────────────────────────────┤  ║
║   │  N₀    │   5-10%   │ Inmediato   │ Stablecoins, Tokens nativos       │  ║
║   │  N₁    │  15-25%   │ < 4 horas   │ Mercados monetarios (Aave, Comp.) │  ║
║   │  N₂    │  50-60%   │ < 48 horas  │ Almacenamiento frío, Bóvedas      │  ║
║   │  N₃    │  10-20%   │ < 7 días    │ Letras del Tesoro, RWA, Bonos     │  ║
║   └────────┴───────────┴─────────────┴───────────────────────────────────┘  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

#### Función de Utilización de Reservas

```
    liquidez_disponible(urgencia) =
        si urgencia == INMEDIATA:
            retornar N₀
        sino si urgencia == URGENTE:
            retornar N₀ + N₁
        sino si urgencia == ESTÁNDAR:
            retornar N₀ + N₁ + N₂
        sino:
            retornar N₀ + N₁ + N₂ + N₃

    ┌──────────────────────────────────────────────────────────────────────┐
    │  GRÁFICO DE ACCESIBILIDAD DE RESERVAS                                │
    │                                                                      │
    │  Reservas  │                                                         │
    │  Disponib. │                                      ┌─────────  100%   │
    │    (%)     │                            ┌─────────┘                  │
    │            │                   ┌────────┘                            │
    │    80%     │                   │                                     │
    │            │          ┌────────┘                                     │
    │    60%     │          │                                              │
    │            │ ┌────────┘                                              │
    │    40%     │ │                                                       │
    │            │ │                                                       │
    │    20%     │ │                                                       │
    │            ├─┘                                                       │
    │     0%     └─────────────────────────────────────────────► tiempo    │
    │            0    4hr    12hr    24hr    48hr    5d     7d             │
    │           N₀    N₁                     N₂            N₃              │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

### Modelo de Cola de Redención

#### Procesamiento de Redención FIFO

```
    Cola = [(cantidad₁, usuario₁, timestamp₁), (cantidad₂, usuario₂, timestamp₂), ...]

    procesar_redención(posición_cola):
        si liquidez_disponible >= cola[posición].cantidad:
            ejecutar_redención(cola[posición])
            retornar ÉXITO
        sino:
            retornar EN_COLA

    Función de prioridad:
    prioridad(solicitud) = prioridad_base + bono_tiempo(edad) + penalidad_tamaño(cantidad)

    donde:
      bono_tiempo(edad) = min(edad / 86400, 10)  // +1 por día, máx +10
      penalidad_tamaño(cantidad) = -log₂(cantidad / solicitud_mediana)
```

### Modelo de Estabilidad Económica

#### Resistencia a Corridas Bancarias

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  MODELO DE SIMULACIÓN DE CORRIDA BANCARIA                                    ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   tasa_redención(t) = tasa_base × (1 + factor_pánico(t))                    ║
║                                                                              ║
║   factor_pánico(t) = α × (1 - RC(t)/100) + β × sentimiento_social(t)        ║
║                                                                              ║
║   El sistema sobrevive si:                                                   ║
║   ∫₀ᵀ tasa_redención(t) dt ≤ Reservas_Totales                               ║
║                                                                              ║
║   donde T = duración de la prueba de estrés                                  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────┐
    │  VISUALIZACIÓN DE PRUEBA DE ESTRÉS DE CORRIDA BANCARIA               │
    │                                                                      │
    │  Reservas │ ████████████████████████████████████████████ 100%       │
    │    (%)    │ ████████████████████████████████████████                │
    │           │ ████████████████████████████████████                    │
    │    75%    │ ████████████████████████████████          ← N₂ agotado  │
    │           │ ████████████████████████████                            │
    │    50%    │ ████████████████████████                                │
    │           │ ████████████████████              ← N₁ agotado          │
    │    25%    │ ████████████████                                        │
    │           │ ████████████████                                        │
    │    10%    │ ██████████████                    ← UMBRAL EMERGENCIA   │
    │           │ ████████──────────────────────────────────────────────  │
    │     0%    └─────────────────────────────────────────────► tiempo    │
    │           0     12hr    24hr    48hr    72hr    96hr    120hr       │
    │                                                                      │
    │  Leyenda: ████ = Reservas restantes                                  │
    │           ──── = Protocolo sobrevive (reservas > 0)                  │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

### Función de Puntuación de Backtest

```
╔══════════════════════════════════════════════════════════════════════════════╗
║  CÁLCULO DE PUNTUACIÓN DE SEGURIDAD ECONÓMICA                                ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║   puntuación = 100                                                           ║
║              - 20 × violaciones_invariante                                   ║
║              - 10 × brechas_ratio_respaldo                                   ║
║              -  5 × horas_fallo_oráculo                                      ║
║              - 15 × pausas_redención                                         ║
║              -  2 × eventos_advertencia                                      ║
║                                                                              ║
║   Criterios de aprobación: puntuación ≥ 80 AND violaciones_invariante == 0  ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

    ┌──────────────────────────────────────────────────────────────────────┐
    │  GRÁFICO DE RENDIMIENTO DE ESCENARIOS                                │
    │                                                                      │
    │  Puntuación│                                                         │
    │   100      │ ●────────────────────────── BASELINE (98)              │
    │            │                                                         │
    │    90      │     ●───────────────────── ORACLE_STRESS (92)          │
    │            │                                                         │
    │    80      │ ════════════════════════════════════════ UMBRAL APROB. │
    │            │          ●─────────────── MARKET_CRASH (85)            │
    │    70      │               ●────────── BANK_RUN (78)                │
    │            │                                                         │
    │    60      │                                                         │
    │            │                    ●──── COMBINED_STRESS (65)          │
    │    50      │                                                         │
    │            │                                                         │
    │     0      └─────────────────────────────────────────────────────── │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
```

### Modelo de Optimización de Gas

```
    costo_gas_acuñación = GAS_BASE
                        + gas_consulta_oráculo
                        + gas_actualización_estado
                        + gas_emisión_evento

    Costos estimados:
    ┌─────────────────────────────────────────────────┐
    │  Operación              │  Unidades de Gas      │
    ├─────────────────────────┼───────────────────────┤
    │  Acuñación base         │  ~65,000              │
    │  Consulta oráculo       │  ~15,000              │
    │  Actualización estado   │  ~25,000              │
    │  Emisión de evento      │  ~3,000               │
    │  Total                  │  ~108,000             │
    └─────────────────────────┴───────────────────────┘
```

---

## Arquitectura

### Vista General del Sistema

```
                                    ARQUITECTURA DE SECUREMINT ENGINE
    ================================================================================

                                   +------------------+
                                   |   FRONTEND       |
                                   |   Panel de       |
                                   |   Control        |
                                   |   (React/Next)   |
                                   +--------+---------+
                                            |
                                            | HTTPS/WSS
                                            v
    +-------------------+          +------------------+          +-------------------+
    |                   |          |                  |          |                   |
    |   INTEGRACIONES   |  REST/   |   PUERTA DE      |  Eventos |   THE GRAPH       |
    |   EXTERNAS        +--------->+   ENLACE API     +--------->+   SUBGRAPH        |
    |                   |  GraphQL |   (Express)      |          |                   |
    +-------------------+          +--------+---------+          +-------------------+
                                            |
                                            | ethers.js / JSON-RPC
                                            v
    ================================================================================
                               CAPA BLOCKCHAIN (EVM)
    ================================================================================

         +-------------+     +------------------+     +-----------------+
         |             |     |                  |     |                 |
         | BackedToken +---->+ SecureMintPolicy +---->+ BackingOracle   |
         | (ERC-20)    |     | (Autorización)   |     | (Feed PoR)      |
         |             |     |                  |     |                 |
         +------+------+     +--------+---------+     +--------+--------+
                |                     |                        |
                |                     v                        |
                |            +------------------+              |
                |            |                  |              |
                +----------->+ TreasuryVault    +<-------------+
                             | (Gestión Reservas)|
                             |                  |
                             +--------+---------+
                                      |
                                      v
                             +------------------+
                             |                  |
                             | RedemptionEngine |
                             | (Quemar y        |
                             |  Redimir)        |
                             +------------------+

    ================================================================================
                              GOBERNANZA Y SEGURIDAD
    ================================================================================

         +-------------+     +------------------+     +-----------------+
         |             |     |                  |     |                 |
         |  Governor   +---->+    Timelock      +---->+ EmergencyPause  |
         | (Votación)  |     | (Acciones       |     | (Interruptor    |
         |             |     |  Diferidas)      |     |  de Circuito)   |
         +-------------+     +------------------+     +-----------------+
```

### Diagrama de Flujo de Solicitudes

```
    SOLICITUD USUARIO            PUERTA DE ENLACE API           BLOCKCHAIN
    =================           ====================            ============

         +                          +                              +
         |   1. Solicitud Acuñar   |                              |
         +------------------------->+                              |
         |                          |                              |
         |                          |  2. Validar JWT/Firma        |
         |                          +--+                           |
         |                          |  | Middleware Auth           |
         |                          +<-+                           |
         |                          |                              |
         |                          |  3. Verificar Límites        |
         |                          +--+                           |
         |                          |  | Caché Redis               |
         |                          +<-+                           |
         |                          |                              |
         |                          |  4. Consultar Estado Oráculo |
         |                          +----------------------------->+
         |                          |                              |
         |                          |  5. Respuesta Oráculo        |
         |                          +<-----------------------------+
         |                          |                              |
         |                          |  6. Verificar Ratio Respaldo |
         |                          +--+                           |
         |                          |  | Verificación INV-SM-1     |
         |                          +<-+                           |
         |                          |                              |
         |                          |  7. Enviar TX Acuñación      |
         |                          +----------------------------->+
         |                          |                              |
         |                          |  8. Confirmación TX          |
         |   9. Respuesta Éxito     +<-----------------------------+
         +<-------------------------+                              |
         |                          |                              |
         +                          +                              +
```

### Capas de Seguridad

```
    ================================================================================
                           MODELO DE SEGURIDAD EN PROFUNDIDAD
    ================================================================================

    CAPA 1: PERÍMETRO DE RED
    +--------------------------------------------------------------------------+
    |  WAF  |  Protección DDoS  |  TLS 1.3  |  Lista Blanca IP  |  Límite Tasa |
    +--------------------------------------------------------------------------+
                                      |
                                      v
    CAPA 2: SEGURIDAD DE APLICACIÓN
    +--------------------------------------------------------------------------+
    |  Auth JWT  |  Protección Nonce  |  RBAC  |  Validación Entrada  |  CORS  |
    +--------------------------------------------------------------------------+
                                      |
                                      v
    CAPA 3: SEGURIDAD API
    +--------------------------------------------------------------------------+
    |  Esquema Zod  |  Límite Profundidad GraphQL  |  Complejidad  |  Sanitizar |
    +--------------------------------------------------------------------------+
                                      |
                                      v
    CAPA 4: SEGURIDAD BLOCKCHAIN
    +--------------------------------------------------------------------------+
    |  Control Oráculo  |  Guardia Reentrancia  |  Control Acceso  |  Pausable |
    +--------------------------------------------------------------------------+
                                      |
                                      v
    CAPA 5: SEGURIDAD OPERACIONAL
    +--------------------------------------------------------------------------+
    |  Multi-Sig  |  Timelock  |  Pausa Emergencia  |  Auditoría  |  Alertas   |
    +--------------------------------------------------------------------------+
```

---

## Invariantes Fundamentales

SecureMint Engine impone cuatro invariantes críticos:

| ID | Invariante | Descripción | Aplicación |
|----|------------|-------------|------------|
| **INV-SM-1** | `suministroTotal <= valorRespaldo` | Tokens acuñados nunca exceden el respaldo total | En cadena + Oráculo |
| **INV-SM-2** | Atestación Fresca de Oráculo | Cada acuñación requiere datos de oráculo < 1 hora | Verificación obsolescencia |
| **INV-SM-3** | Auto-Pausa por Sub-respaldo | Acuñación se pausa si ratio respaldo < 100% | Interruptor circuito |
| **INV-SM-4** | Emisión de Eventos | Todas las acuñaciones emiten eventos verificables en cadena | Logs inmutables |

```
    FLUJO DE APLICACIÓN DE INVARIANTES
    ===================================

    Solicitud Acuñación
         |
         v
    +----+----+
    | Verificar|    INV-SM-2: Frescura oráculo
    | Edad    +--> ¿Obsolescencia > 1hr? --> RECHAZAR
    | Oráculo |
    +----+----+
         |
         v
    +----+----+
    | Verificar|    INV-SM-1: Suficiencia respaldo
    | Ratio   +--> ¿suministro + cantidad > respaldo? --> RECHAZAR
    | Respaldo|
    +----+----+
         |
         v
    +----+----+
    | Verificar|    INV-SM-3: Salud del sistema
    | Estado  +--> ¿estáPausado? --> RECHAZAR
    | Pausado |
    +----+----+
         |
         v
    +----+----+
    | Ejecutar|    INV-SM-4: Emitir evento
    | Acuñar  +--> MintExecuted(destinatario, cantidad, respaldo)
    | y Log   |
    +---------+
```

---

## Auditoría de Seguridad

### Estado de la Auditoría

Este código ha sido sometido a una revisión de seguridad integral con los siguientes hallazgos abordados:

| ID | Hallazgo | Severidad | Estado |
|----|----------|-----------|--------|
| SEC-001 | Claves API hardcodeadas | Crítico | CORREGIDO |
| SEC-002 | Secreto JWT débil | Alto | CORREGIDO |
| SEC-003 | Sin protección nonce (ataques replay) | Alto | CORREGIDO |
| SEC-004 | Falta verificación de transacción firmada | Alto | CORREGIDO |
| SEC-007 | Introspección GraphQL en producción | Medio | CORREGIDO |
| SEC-008 | Limitación de tasa por usuario | Medio | CORREGIDO |
| SEC-009 | Configuración TLS de Redis | Medio | CORREGIDO |
| SEC-010 | Validación de esquema Zod | Medio | CORREGIDO |

### Listas de Verificación de Seguridad

- [Lista de Verificación Stack A](security_audit/CHECKLIST_STACK_A.md) - Next.js + Node + Postgres + WalletConnect
- [Lista de Verificación Stack C](security_audit/CHECKLIST_STACK_C.md) - EVM Solidity (Hardhat/Foundry)
- [Plan de Remediación](security_audit/REMEDIATION_PLAN.md) - Detalles completos de remediación de auditoría

### Pruebas de Regresión

Las pruebas de regresión de seguridad aseguran que las vulnerabilidades no puedan ser reintroducidas:

```bash
# Ejecutar todas las pruebas de regresión de seguridad
npm test -- --testPathPattern="REGRESSION_TESTS"

# Suites de pruebas individuales
npm test -- auth.test.ts        # SEC-001, SEC-002, SEC-003
npm test -- rate-limit.test.ts  # SEC-008
npm test -- input.test.ts       # SEC-010
```

---

## Estructura del Proyecto

```
secure-mint-engine/
├── assets/
│   ├── contracts/              # Contratos inteligentes Solidity
│   │   ├── src/
│   │   │   ├── BackedToken.sol
│   │   │   ├── SecureMintPolicy.sol
│   │   │   ├── BackingOraclePoR.sol
│   │   │   ├── TreasuryVault.sol
│   │   │   ├── RedemptionEngine.sol
│   │   │   ├── EmergencyPause.sol
│   │   │   ├── Governor.sol
│   │   │   └── Timelock.sol
│   │   └── test/
│   │       ├── unit/
│   │       ├── integration/
│   │       └── security/
│   │
│   ├── api-gateway/            # Servidor API REST/GraphQL
│   │   └── src/
│   │       ├── server.ts
│   │       ├── routes/
│   │       │   └── mint.ts
│   │       └── middleware/
│   │           ├── auth.ts     # Auth JWT + Firma
│   │           └── cache.ts    # Limitación de tasa
│   │
│   ├── sdk/                    # SDK TypeScript
│   │   └── src/
│   │       ├── index.ts
│   │       ├── react/          # Hooks React
│   │       └── compliance/     # Verificaciones de cumplimiento
│   │
│   ├── subgraph/               # Indexador The Graph
│   ├── dashboard/              # UI de monitoreo admin
│   ├── scripts/
│   │   └── backtest/           # Motor de pruebas retrospectivas
│   │       ├── backtest-engine.ts
│   │       └── index.ts
│   ├── config/                 # Archivos de configuración
│   └── examples/
│       ├── dapp/               # DApp de ejemplo
│       └── cli/                # Ejemplos CLI
│
├── security_audit/             # Documentación de seguridad
│   ├── CI_SECURITY.yml         # Pipeline CI de seguridad
│   ├── CHECKLIST_STACK_A.md    # Lista verificación stack web
│   ├── CHECKLIST_STACK_C.md    # Lista verificación Solidity
│   ├── REMEDIATION_PLAN.md     # Remediación de auditoría
│   └── REGRESSION_TESTS/       # Pruebas de seguridad
│       ├── auth.test.ts
│       ├── rate-limit.test.ts
│       └── input.test.ts
│
├── docs/                       # Documentación
│   └── guides/
├── docker/                     # Configuraciones Docker
├── tests/                      # Pruebas de integración
├── LICENSE                     # Licencia MIT
├── README.md                   # Documentación en inglés
└── README_ES.md                # Este archivo (español)
```

---

## Inicio Rápido

### Prerrequisitos

- **Node.js** 18+ ([descargar](https://nodejs.org/))
- **npm** o **yarn**
- **Foundry** (para pruebas Solidity) - [instalar](https://book.getfoundry.sh/getting-started/installation)
- **Redis** (para limitación de tasa) - [instalar](https://redis.io/docs/getting-started/)
- **PostgreSQL** (opcional, para persistencia API)

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/rikitrader/secure-mint-engine.git
cd secure-mint-engine

# 2. Instalar dependencias de contratos
cd assets/contracts
npm install
forge install

# 3. Instalar dependencias de API gateway
cd ../api-gateway
npm install

# 4. Instalar dependencias del SDK
cd ../sdk
npm install

# 5. Volver a la raíz
cd ../..
```

### Configuración del Entorno

```bash
# Copiar archivos de entorno de ejemplo
cp assets/config/.env.example assets/config/.env

# Editar configuración
nano assets/config/.env
```

**Variables de Entorno Requeridas:**

```env
# Configuración JWT (REQUERIDO - debe ser 32+ caracteres)
JWT_SECRET=tu-secreto-aleatorio-seguro-minimo-32-caracteres

# Configuración Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=tu-contraseña-redis

# Configuración Blockchain
RPC_URL=https://mainnet.infura.io/v3/TU_CLAVE
CHAIN_ID=1

# Direcciones de Contratos (después del despliegue)
TOKEN_ADDRESS=0x...
POLICY_ADDRESS=0x...
ORACLE_ADDRESS=0x...
TREASURY_ADDRESS=0x...
```

### Compilar y Probar

```bash
# Compilar contratos inteligentes
cd assets/contracts
npx hardhat compile
forge build

# Ejecutar pruebas
npx hardhat test
forge test

# Ejecutar con cobertura
npx hardhat coverage
forge coverage
```

### Iniciar Servidor de Desarrollo

```bash
# Iniciar Redis (si no está corriendo)
redis-server

# Iniciar API Gateway
cd assets/api-gateway
npm run dev

# El servidor corre en http://localhost:3000
```

---

## Contratos Inteligentes

### Vista General de Contratos

| Contrato | Propósito | Actualizabilidad |
|----------|-----------|------------------|
| `BackedToken.sol` | Token ERC-20 con acuñación controlada por oráculo | UUPS |
| `SecureMintPolicy.sol` | Autorización de acuñación y aplicación de invariantes | UUPS |
| `BackingOraclePoR.sol` | Agregación de oráculos y Prueba de Reservas | UUPS |
| `TreasuryVault.sol` | Gestión de reservas y custodia de activos | UUPS |
| `RedemptionEngine.sol` | Redención de tokens por activos de respaldo | UUPS |
| `EmergencyPause.sol` | Interruptor de circuito y controles de emergencia | Inmutable |
| `Governor.sol` | Gobernanza en cadena | Inmutable |
| `Timelock.sol` | Ejecución diferida en tiempo | Inmutable |

### Despliegue

```bash
# Desplegar en red local
cd assets/contracts
npx hardhat node
npx hardhat deploy --network localhost

# Desplegar en testnet
npx hardhat deploy --network sepolia

# Desplegar en mainnet
npx hardhat deploy --network mainnet

# Verificar contratos
npx hardhat verify --network mainnet <DIRECCIÓN_CONTRATO>
```

### Comandos de Foundry

```bash
# Construir
forge build

# Probar
forge test -vvv

# Probar con reporte de gas
forge test --gas-report

# Pruebas de fuzzing
forge test --fuzz-runs 10000

# Pruebas de invariantes
forge test --match-contract "Invariant"

# Cobertura
forge coverage

# Análisis de seguridad con Slither
slither .
```

---

## Puerta de Enlace API

### Endpoints

#### Autenticación

```
POST /api/auth/nonce          - Solicitar nonce de autenticación
POST /api/auth/verify         - Verificar firma y obtener JWT
POST /api/auth/refresh        - Refrescar token JWT
```

#### Acuñación

```
GET  /api/mint/capacity       - Obtener capacidad de acuñación disponible
POST /api/mint/simulate       - Simular transacción de acuñación
POST /api/mint/execute        - Ejecutar acuñación (requiere firma)
GET  /api/mint/history        - Obtener historial de acuñación
```

#### Oráculo

```
GET  /api/oracle/backing      - Obtener ratio de respaldo actual
GET  /api/oracle/price        - Obtener feed de precio del oráculo
GET  /api/oracle/health       - Verificar salud del oráculo
```

#### Tesorería

```
GET  /api/treasury/balance    - Obtener balance de tesorería
GET  /api/treasury/reserves   - Obtener desglose de reservas
```

### Límites de Tasa

| Nivel | Límite | Ventana |
|-------|--------|---------|
| Anónimo (IP) | 20 req | 1 min |
| Autenticado (IP) | 100 req | 1 min |
| Por Usuario | 100 req | 1 min |
| Por Wallet (ops acuñación) | 50 req | 1 min |

---

## Uso del SDK

### Instalación

```bash
npm install @securemint/sdk
```

### Uso Básico

```typescript
import { SecureMintSDK } from '@securemint/sdk';

// Inicializar SDK
const sdk = new SecureMintSDK({
  provider: window.ethereum,
  chainId: 1,
  addresses: {
    token: '0x...',
    policy: '0x...',
    oracle: '0x...',
  }
});

// Verificar elegibilidad de acuñación
const puedeAcuñar = await sdk.policy.canMint(cantidad);
console.log('Puede acuñar:', puedeAcuñar);

// Obtener ratio de respaldo
const ratio = await sdk.oracle.getBackingRatio();
console.log('Ratio de respaldo:', ratio);

// Ejecutar acuñación (con firma)
const tx = await sdk.token.mint(destinatario, cantidad);
await tx.wait();
```

### Hooks de React

```typescript
import { useSecureMint, useMintCapacity, useBackingRatio } from '@securemint/sdk/react';

function ComponenteAcuñacion() {
  const { mint, isLoading, error } = useSecureMint();
  const { capacity } = useMintCapacity();
  const { ratio } = useBackingRatio();

  return (
    <div>
      <p>Ratio de Respaldo: {ratio}%</p>
      <p>Capacidad Disponible: {capacity}</p>
      <button onClick={() => mint(cantidad)} disabled={isLoading}>
        Acuñar Tokens
      </button>
    </div>
  );
}
```

---

## Motor de Pruebas Retrospectivas

El Motor de Pruebas Retrospectivas simula el comportamiento del protocolo bajo varias condiciones de mercado para validar la seguridad económica.

### Ejecutando Pruebas Retrospectivas

```bash
cd assets

# Ejecutar escenario base (año completo)
npx ts-node scripts/backtest/backtest-engine.ts 2024-01-01 2024-12-31

# Ejecutar escenarios específicos
npx ts-node -e "import('./scripts/backtest').then(m => m.runBacktest('BANK_RUN'))"
npx ts-node -e "import('./scripts/backtest').then(m => m.runBacktest('ORACLE_STRESS'))"
npx ts-node -e "import('./scripts/backtest').then(m => m.runBacktest('MARKET_CRASH'))"

# Ejecutar todos los escenarios (integración CI)
npx ts-node -e "import('./scripts/backtest').then(m => m.runAllScenarios())"
```

### Escenarios Disponibles

| Escenario | Descripción | Duración |
|-----------|-------------|----------|
| `BASELINE` | Condiciones normales de mercado | 1 año |
| `BANK_RUN` | 15% tasa de redención por hora | 3 meses |
| `ORACLE_STRESS` | 1% probabilidad de fallo de oráculo | 6 meses |
| `MARKET_CRASH` | Evento de caída de precio del 30% | 6 meses |
| `COMBINED_STRESS` | Todos los factores de estrés combinados | 1 año |

### Métricas de Pruebas Retrospectivas

```
    MÉTRICAS DE SALIDA DE BACKTEST
    ==============================

    Puntuación de Seguridad Económica: 0-100
    +------------------------+
    |  Violaciones Invariante|  -20 puntos cada una
    |  Ratio Respaldo < 100% |  -10 puntos por ocurrencia
    |  Fallos de Oráculo     |  -5 puntos por hora
    |  Pausas de Redención   |  -15 puntos cada una
    +------------------------+

    Criterios de Aprobación:
    - Puntuación >= 80
    - Cero violaciones de invariantes
```

---

## Pruebas

### Pruebas Unitarias

```bash
# Contratos inteligentes (Hardhat)
cd assets/contracts
npx hardhat test

# Contratos inteligentes (Foundry)
forge test

# API Gateway
cd assets/api-gateway
npm test

# SDK
cd assets/sdk
npm test
```

### Pruebas de Seguridad

```bash
# Ejecutar todas las pruebas de seguridad
npm test -- --testPathPattern="security"

# Ejecutar pruebas de regresión
npm test -- --testPathPattern="REGRESSION_TESTS"

# Ejecutar con cobertura
npm test -- --coverage
```

### Pruebas de Fuzzing

```bash
# Pruebas de fuzz con Foundry
cd assets/contracts
forge test --fuzz-runs 10000 --match-contract "Fuzz"

# Echidna (si está configurado)
echidna test/fuzzing/EchidnaSecureMint.sol --contract EchidnaSecureMint
```

### Pruebas de Invariantes

```bash
# Pruebas de invariantes con Foundry
forge test --match-contract "Invariant" --fuzz-runs 1000 -vvv
```

---

## Despliegue

### Lista de Verificación de Despliegue

```
    LISTA DE VERIFICACIÓN PRE-DESPLIEGUE
    =====================================

    [ ] Todas las pruebas pasando
    [ ] Auditoría de seguridad completa
    [ ] Análisis Slither limpio
    [ ] Cobertura > 80%
    [ ] Escenarios de backtest pasando
    [ ] Variables de entorno configuradas
    [ ] Wallets multi-sig listas
    [ ] Feeds de oráculo configurados
    [ ] Contactos de emergencia listos

    SECUENCIA DE DESPLIEGUE
    =======================

    1. Desplegar Timelock
    2. Desplegar Governor
    3. Desplegar EmergencyPause
    4. Desplegar BackingOraclePoR
    5. Desplegar TreasuryVault
    6. Desplegar SecureMintPolicy
    7. Desplegar BackedToken
    8. Desplegar RedemptionEngine
    9. Configurar permisos
    10. Transferir propiedad a Timelock
```

### Pipeline CI/CD

El pipeline de seguridad CI en `security_audit/CI_SECURITY.yml` ejecuta:

1. **Auditoría de Dependencias** - npm audit + Snyk
2. **Escaneo de Secretos** - TruffleHog + coincidencia de patrones
3. **Análisis Slither** - Análisis estático para Solidity
4. **Pruebas Foundry** - Pruebas unitarias, fuzz e invariantes
5. **Pruebas de Seguridad API** - Autenticación y autorización
6. **ESLint Seguridad** - Reglas de seguridad para TypeScript
7. **Motor de Backtest** - Simulación económica
8. **Pruebas de Regresión** - Prevención de vulnerabilidades de seguridad

**Todas las verificaciones deben pasar antes de fusionar a main.**

---

## Licencia y Divulgaciones de Terceros

### Licencia del Proyecto

Este proyecto está licenciado bajo la **Licencia MIT** - ver el archivo [LICENSE](LICENSE) para detalles.

```
Licencia MIT

Copyright (c) 2024 SecureMint Engine

Se concede permiso, de forma gratuita, a cualquier persona que obtenga una copia
de este software y los archivos de documentación asociados (el "Software"), para
tratar el Software sin restricciones, incluyendo sin limitación los derechos de
usar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y/o vender
copias del Software, y permitir a las personas a quienes se les proporcione el
Software hacer lo mismo, sujeto a las siguientes condiciones:

El aviso de copyright anterior y este aviso de permiso se incluirán en todas las
copias o porciones sustanciales del Software.

EL SOFTWARE SE PROPORCIONA "TAL CUAL", SIN GARANTÍA DE NINGÚN TIPO, EXPRESA O
IMPLÍCITA, INCLUYENDO PERO NO LIMITADO A LAS GARANTÍAS DE COMERCIABILIDAD,
IDONEIDAD PARA UN PROPÓSITO PARTICULAR Y NO INFRACCIÓN. EN NINGÚN CASO LOS
AUTORES O TITULARES DE DERECHOS DE AUTOR SERÁN RESPONSABLES DE NINGÚN RECLAMO,
DAÑO U OTRA RESPONSABILIDAD, YA SEA EN UNA ACCIÓN DE CONTRATO, AGRAVIO O DE
OTRO MODO, QUE SURJA DE, FUERA DE O EN CONEXIÓN CON EL SOFTWARE O EL USO U
OTROS TRATOS EN EL SOFTWARE.
```

### Dependencias de Terceros y Licencias

#### Contratos Inteligentes

| Paquete | Versión | Licencia | Descripción |
|---------|---------|----------|-------------|
| [@openzeppelin/contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) | ^5.0.0 | MIT | Biblioteca de contratos inteligentes seguros |
| [@openzeppelin/contracts-upgradeable](https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable) | ^5.0.0 | MIT | Contratos actualizables |
| [@chainlink/contracts](https://github.com/smartcontractkit/chainlink) | ^0.8.0 | MIT | Integración de oráculos |
| [hardhat](https://github.com/NomicFoundation/hardhat) | ^2.19.0 | MIT | Entorno de desarrollo Ethereum |
| [foundry](https://github.com/foundry-rs/foundry) | latest | MIT/Apache-2.0 | Toolkit de contratos inteligentes |

#### API Gateway

| Paquete | Versión | Licencia | Descripción |
|---------|---------|----------|-------------|
| [express](https://github.com/expressjs/express) | ^4.18.0 | MIT | Framework web |
| [ethers](https://github.com/ethers-io/ethers.js) | ^6.9.0 | MIT | Biblioteca Ethereum |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | ^9.0.0 | MIT | Autenticación JWT |
| [ioredis](https://github.com/redis/ioredis) | ^5.3.0 | MIT | Cliente Redis |
| [zod](https://github.com/colinhacks/zod) | ^3.22.0 | MIT | Validación de esquemas |
| [graphql](https://github.com/graphql/graphql-js) | ^16.8.0 | MIT | Implementación GraphQL |
| [@apollo/server](https://github.com/apollographql/apollo-server) | ^4.9.0 | MIT | Servidor GraphQL |
| [helmet](https://github.com/helmetjs/helmet) | ^7.1.0 | MIT | Cabeceras de seguridad |
| [@prisma/client](https://github.com/prisma/prisma) | ^5.6.0 | Apache-2.0 | ORM de base de datos |

#### SDK

| Paquete | Versión | Licencia | Descripción |
|---------|---------|----------|-------------|
| [ethers](https://github.com/ethers-io/ethers.js) | ^6.9.0 | MIT | Biblioteca Ethereum |
| [axios](https://github.com/axios/axios) | ^1.6.0 | MIT | Cliente HTTP |
| [ws](https://github.com/websockets/ws) | ^8.14.0 | MIT | Cliente WebSocket |
| [eventemitter3](https://github.com/primus/eventemitter3) | ^5.0.0 | MIT | Emisor de eventos |

#### Herramientas de Desarrollo

| Paquete | Versión | Licencia | Descripción |
|---------|---------|----------|-------------|
| [typescript](https://github.com/microsoft/TypeScript) | ^5.3.0 | Apache-2.0 | Compilador TypeScript |
| [jest](https://github.com/facebook/jest) | ^29.7.0 | MIT | Framework de pruebas |
| [eslint](https://github.com/eslint/eslint) | ^8.50.0 | MIT | Linting |
| [prettier](https://github.com/prettier/prettier) | ^3.1.0 | MIT | Formateo de código |
| [supertest](https://github.com/ladjs/supertest) | ^6.3.0 | MIT | Pruebas HTTP |

### Notas de Cumplimiento de Licencias

1. **Licencia MIT** - La mayoría de las dependencias están licenciadas bajo MIT, permitiendo uso libre, modificación y distribución con atribución.

2. **Licencia Apache-2.0** - TypeScript y Prisma usan Apache-2.0, que requiere preservación de avisos de copyright e incluye provisiones de concesión de patentes.

3. **Contratos OpenZeppelin** - Usados bajo licencia MIT. Implementaciones auditadas de seguridad de estándares ERC.

4. **Contratos Chainlink** - Usados bajo licencia MIT para integración de oráculos.

### Aviso para Redistribuidores

Al redistribuir este software, debe:

1. Incluir el archivo de licencia MIT original
2. Incluir avisos de copyright para todas las dependencias de terceros
3. Preservar la atribución en archivos fuente
4. No usar nombres o logos del proyecto para promocionar productos derivados

---

## Contribuciones

¡Damos la bienvenida a contribuciones! Por favor vea nuestras directrices de contribución:

1. Haga fork del repositorio
2. Cree una rama de característica (`git checkout -b feature/caracteristica-increible`)
3. Haga commit de sus cambios (`git commit -m 'Agregar característica increíble'`)
4. Haga push a la rama (`git push origin feature/caracteristica-increible`)
5. Abra un Pull Request

### Estándares de Código

- Todo el código debe pasar las verificaciones de seguridad CI
- Cobertura mínima de pruebas del 80%
- El análisis de Slither debe estar limpio
- Seguir el estilo de código existente (aplicado por ESLint/Prettier)

---

## Contacto

**Repositorio:** [github.com/rikitrader/secure-mint-engine](https://github.com/rikitrader/secure-mint-engine)

**Autor:** Ricardo Prieto

Para vulnerabilidades de seguridad, por favor reporte responsablemente a través de GitHub Security Advisories.

---

<div align="center">

```
    Construido con principios de seguridad primero para el futuro descentralizado.

    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║   "Sin prueba de respaldo = Sin acuñación"                    ║
    ║                                                               ║
    ║   SecureMint Engine - Acuñación Empresarial con Control       ║
    ║   de Oráculos                                                 ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
```

**Copyright (c) 2024 SecureMint Engine - Licencia MIT**

</div>

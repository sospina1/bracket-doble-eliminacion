# Bracket Doble Eliminación

Generador de brackets de doble eliminación con el mismo formato que la Clash Royale League (CRL) 2026: Upper Bracket, Lower Bracket y Gran Final con reinicio de bracket.

## Qué hace

- Escribes los jugadores (uno por línea) y el sistema arma el bracket solo.
- Dos formas de repartir:
  - **Por seeding**: el orden en que los escribes es el seed. El 1.º se cruza con el último y los dos mejores solo pueden encontrarse en la final.
  - **Al azar**: sorteo aleatorio.
- Funciona con **cualquier cantidad entre 4 y 64 jugadores**. Si no es potencia de 2 (por ejemplo 10 o 12), los mejores seeds pasan directo (BYE).
- Registras el marcador de cada serie: el ganador avanza solo, el perdedor baja al Lower y con la segunda derrota queda eliminado.
- Configurable: mejor de 1/3/5/7 para las series normales y para las finales (Final Upper, Final Lower y Gran Final). El reinicio de bracket se puede activar o desactivar.
- Clasificación final (1.º, 2.º, 3.º, 4.º, 5.º–6.º…).
- Exportar e importar el torneo en `.json`. El progreso se guarda en tu navegador.
- Incluye un ejemplo con los 16 jugadores de la CRL 2026.

## Uso

Es una página estática, no necesita instalar nada: abre `index.html` en el navegador o publícala con GitHub Pages.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Estructura de la página |
| `style.css` | Estilos (modo claro y oscuro) |
| `bracket.js` | Motor del torneo: cruces, byes, avance de ganadores y perdedores |
| `app.js` | Interfaz: dibuja el bracket y guarda los resultados |
| `tests/bracket.test.js` | Pruebas del motor (`node tests/bracket.test.js`) |

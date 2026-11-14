# GESTCON — Fase 5: repositorio para GitHub

Repositorio completo en `Fase5/gestcon` (ya con `git init` y un primer commit en la rama `main`):

- Código de la app (`src/`), configuración de Vite/Tailwind/TypeScript y `package-lock.json`.
- `.github/workflows/deploy.yml`: compila y publica en GitHub Pages con cada subida a `main` (o a mano desde Actions).
- `README.md`: publicación en GitHub, preparación de la carpeta de red, uso diario, modificación de plantillas, problemas habituales y desarrollo.
- `docs/esquema.sql` y `docs/etiquetas-plantillas.md` (etiquetas, formatos y tramos de campaña).
- No incluye datos ni plantillas: `datos.sqlite` (Fase2) y las 8 plantillas (Fase3) se copian a la carpeta de red.

Publicación: crear el repositorio vacío en GitHub, `git remote add origin …`, `git push -u origin main`, y en Settings → Pages elegir «GitHub Actions». La app queda en `https://USUARIO.github.io/NOMBRE_REPO/` (base relativa, funciona con cualquier nombre).

## Verificación
- Clonado limpio del repositorio → `npm ci` + `npm run build` correctos; el YAML del workflow es válido.
- La compilación del clon, servida bajo una subruta (`/gestcon/`, como GitHub Pages), pasa las 29 pruebas de extremo a extremo en Chrome (datos y plantillas reales en carpeta simulada).
- No se ha podido ejecutar el workflow en GitHub ni probar con una unidad de red real ni con Edge.

// La página no permite eval (CSP). zod decide al crear cada esquema si compila validadores con
// new Function; con jitless no lo intenta. Este módulo se importa antes que todo lo demás.
import { z } from 'zod';

z.config({ jitless: true });

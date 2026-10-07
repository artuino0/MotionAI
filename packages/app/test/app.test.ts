import { describe, expect, it } from 'vitest';
import { describirReferencias } from '../src/principal/chat.js';
import { markdown } from '../src/interfaz/util/markdown.js';

describe('referencias del mensaje', () => {
  it('describe lo que tocó el usuario', () => {
    const t = describirReferencias([
      { tipo: 'pieza', id: 'titulo', escena: 'e2', t: 4.25, punto: [540.4, 960] },
      { tipo: 'escena', id: 'e3', nombre: 'Cierre', t: 9 },
      { tipo: 'frase', id: 'f2', nombre: 'Ven hoy' },
    ]);
    expect(t).toContain('pieza "titulo", en la escena "e2", a los 4.25 s, punto (540, 960) del lienzo');
    expect(t).toContain('escena "e3" (Cierre)');
    expect(t).toContain('frase f2 ("Ven hoy")');
    expect(describirReferencias([])).toBe('');
  });
});

describe('markdown del chat', () => {
  it('escapa HTML y da formato básico', () => {
    const h = markdown('Hola **mundo** <script>x</script>\n\n- uno\n- `dos`\n\n| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(h).toContain('<strong>mundo</strong>');
    expect(h).toContain('&lt;script&gt;');
    expect(h).not.toContain('<script>');
    expect(h).toContain('<ul><li>uno</li><li><code>dos</code></li></ul>');
    expect(h).toContain('<th>A</th>');
    expect(h).toContain('<td>2</td>');
  });
});

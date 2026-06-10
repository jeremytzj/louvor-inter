<div align="center">
  <h1>🎸 Repertório Inter 2026</h1>
  <p><i>Um gerenciador de cifras e áudios em formato Single Page Application (SPA).</i></p>
</div>

---

## ✨ Funcionalidades

- **Layout Responsivo & Inteligente:** As cifras se organizam automaticamente em colunas dinâmicas (no estilo partitura), aproveitando todo o espaço do monitor e extinguindo a necessidade de rolagem vertical durante a leitura.
- **Transpositor de Acordes:** Modifique o tom da música com um clique (`+1 Tom` / `-1 Tom`). A lógica matemática interna compreende sustenidos, bemóis, notas com baixo (ex: `D/F#`) e todos os modificadores (sus4, m7, etc).
- **Player de Áudio Integrado:** Escute a referência original enquanto lê a cifra. A interface suporta nativamente faixas únicas e também múltiplas faixas (útil para medleys).
- **Modo Escuro (Dark Mode):** Alternância instantânea de tema (claro/escuro) para conforto visual, ideal para palcos ou ambientes escuros.
- **Barra Lateral Retrátil:** Navegação rápida. A lista é gerada e ordenada alfabeticamente, de forma totalmente automática.

## 🛠 Tecnologias Utilizadas

O projeto foi construído **100% sem frameworks (Vanilla)**, focando em simplicidade, leveza e facilidade de deploy via *GitHub Pages*.
- **HTML5:** Estrutura limpa e semântica.
- **CSS3:** Variáveis nativas (design tokens) para a troca de temas e uso avançado de Flexbox em colunas dinâmicas para organizar perfeitamente o texto da cifra na tela inteira.
- **JavaScript (ES6):** Manipulação de DOM limpa, cálculos modulares (base 12) em vetores circulares para a transposição musical, e leitura de arquivos via *Fetch API*.

## 🚀 Como Rodar Localmente

O aplicativo lê o catálogo de músicas de um arquivo `.json`. Por conta da segurança natural do navegador (políticas de CORS), isso exige um servidor web rodando para funcionar (não adianta só dar dois cliques no `index.html`).

Para rodar localmente no seu computador (tendo o Node.js instalado):
```bash
npx serve .
```
E acesse `http://localhost:3000` (ou a porta informada no terminal).

## 📝 Como Adicionar Novas Músicas

O repertório inteiro é controlado através de um único "banco de dados" em formato JSON:
📍 **`src/cyphers.json`**

Estrutura base de uma música:
```json
{
  "id": "id-unico-da-musica",
  "titulo": "Nome da Música",
  "tom_original": "E",
  "audio_url": "/src/audio/Arquivo.mp3",
  "cifra_chordpro": "..."
}
```
*(Dica: Para adicionar mais de um áudio na mesma página, substitua `audio_url` por um array de objetos chamado `audio_urls`).*

### Sintaxe Especial da Cifra (`cifra_chordpro`)
A aplicação conta com um "motor de renderização" próprio que converte texto simples em uma cifra formatada. Para que ele funcione, siga a seguinte formatação de digitação:

1. **Seções / Títulos:** Envolva palavras entre chaves para criar títulos em destaque colorido.
   - *Exemplo:* `{Verso 1}`, `{Refrão}`, `{Ponte}`
2. **Acordes em cima das palavras:** Escreva o acorde entre colchetes imediatamente **antes** da palavra/sílaba em que a batida da nota entra.
   - *Exemplo:* `Eu te a[A9]mo Se[B9]nhor`
3. **Acordes soltos (Intros e solos):** Para mostrar acordes que não tem letra junto, coloque-os normalmente e adicione um `|` (ou espaços extras) pra facilitar a formatação visual pra você no JSON.
   - *Exemplo:* `[Intro]\n [A|] [B|] [C#m|]`

---

Feito com 🤍 para garantir ensaios mais fluidos e práticos.

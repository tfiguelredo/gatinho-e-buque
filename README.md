# gatinho-e-buque

Uma pequena experiência de arte em código, em tela preta, estilo terminal:

1. Um gatinho **tigrado** desenhado com caracteres entra andando com uma rosa na boca, senta, deixa a rosa à sua frente e um coraçãozinho aparece sobre a cabeça.
2. O desenho se desfaz em bits e, no lugar, um **buquê** vai sendo construído com **0 e 1**: cabo, papel, laço, hastes, folhas e, por fim, as flores desabrochando (rosas brancas com tulipas rosa e pêssego e margaridas lilás e amarela), girando devagar.

Sem frameworks, sem build: HTML + JavaScript puro desenhando num `<canvas>`.

## Rodar localmente

Os módulos JavaScript precisam ser servidos por HTTP (abrir o `index.html` direto com duplo clique não funciona em todos os navegadores). Na pasta do projeto:

```bash
python3 -m http.server 8000
```

Depois abra <http://localhost:8000>.

Para revisar só o buquê, abra <http://localhost:8000/#buque>. Para comparar composições sem editar nada: <http://localhost:8000/?buque=rosas#buque>.

## Personalizar

Tudo fica em [`js/config.js`](js/config.js):

| Opção | O que faz |
| --- | --- |
| `showCard` | `true` para mostrar o cartão que sai do envelope (padrão: só a rosa) |
| `cardText`, `cardOptions` | Texto do cartão, se ele estiver ligado |
| `bouquet` | Composição das flores: `colorido` (padrão), `rosas`, `rosas-margaridas`, `rosas-tulipas`, `rosas-mosquitinho` |
| `message` | Texto sob o buquê |
| `spinSpeed`, `tilt`, `camDist` | Giro e câmera do buquê |
| `numHearts` | Corações ao fundo |
| `catHold` | Quanto tempo a cena do gato fica parada antes da transição |

## Estrutura

```
index.html          página (só o canvas)
css/style.css       fundo preto, tela cheia
js/main.js          sequência: gato → transição em bits → buquê
js/grid.js          "terminal" em canvas (grade de caracteres + z-buffer)
js/cat.js           o gatinho tigrado e a rosa
js/bouquet.js       o buquê 3D em binário (rosas, tulipas, margaridas)
js/config.js        textos e ajustes
```

## Créditos

- O buquê é adaptado de [Ascii Flower Bouquet](https://github.com/alishsharma17/Ascii-Flower-Bouquet-), de Alish Sharma (licença MIT). Veja [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- A ideia do gatinho entregando a rosa vem de um vídeo de @alishsharma no TikTok; os desenhos aqui foram refeitos do zero.

Licença: MIT ([LICENSE](LICENSE)).

# Ludo Online, com servidor próprio

Jogo de Ludo para até 4 pessoas jogando ao mesmo tempo em aparelhos diferentes (celular e PC), em tela cheia.
Ninguém precisa de conta: cada pessoa abre o link do site, digita o nome e entra.

- Servidor em Node.js puro, **sem nenhuma dependência** (não precisa de `npm install`).
- Tempo real com Server-Sent Events: funciona em qualquer hospedagem comum.
- O servidor controla dado e regras, então ninguém consegue trapacear pelo navegador.
- Lista de **salas abertas**, lista de **jogadores online** e aviso para todos quando uma sala é criada.
- Quem cai da internet volta para o mesmo lugar ao reabrir. Enquanto isso, o computador joga por ele.
- Também tem o modo **Jogar neste aparelho** (4 pessoas no mesmo celular/PC) e jogadores **CPU**.

## Arquivos

```
server.js            servidor (salas, regras, tempo real)
public/index.html    o jogo (tabuleiro, telas)
public/rules.js      regras do Ludo (usadas pelo servidor e pelo modo local)
public/manifest.json permite "Adicionar à tela inicial" em tela cheia
package.json
```

## Testar no seu computador

1. Instale o Node.js 18 ou mais novo (https://nodejs.org).
2. Abra o terminal nesta pasta e rode: `node server.js`
3. Abra http://localhost:3000

**Jogar na mesma rede Wi-Fi:** com o servidor rodando no PC, descubra o IP do PC (no Windows: `ipconfig`; procure "Endereço IPv4", por exemplo 192.168.0.15). Nos celulares, abra `http://192.168.0.15:3000`. Se não abrir, libere o Node no firewall do Windows.

## Colocar na internet de graça (Render)

1. Crie uma conta no **GitHub** (https://github.com) e um repositório novo, por exemplo `ludo-online`.
   Envie todos os arquivos desta pasta para ele (botão "Add file" → "Upload files" e arraste a pasta).
2. Crie uma conta no **Render** (https://render.com) entrando com o GitHub.
3. Clique em **New** → **Web Service** e escolha o repositório `ludo-online`.
4. Configure:
   - **Runtime:** Node
   - **Build Command:** deixe vazio (ou `echo ok`)
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
5. Clique em **Create Web Service**. Em 1 a 2 minutos você recebe um link como `https://ludo-online.onrender.com`.
6. Mande esse link para os amigos. Pronto!

> No plano grátis do Render, o servidor "dorme" depois de 15 minutos sem ninguém. A primeira pessoa que abrir o jogo espera de 30 a 60 segundos até ele acordar; depois fica rápido.

**Outras opções que também funcionam:** Railway, Fly.io, Koyeb ou qualquer VPS. Basta rodar `node server.js`; a porta vem da variável `PORT`.

## Como jogar online

1. Abra o site, digite seu nome e toque em **Criar sala online**.
2. Toque em **🔗 Copiar link** e mande para os amigos. Outra forma: eles abrem o site e tocam em
   **🔎 Ver salas online abertas** → **Entrar**. Quem estiver no site também recebe um aviso de que a sala foi criada.
3. Cada um ganha uma cor livre automaticamente. Quem criou a sala pode pôr **CPU** nos lugares vazios.
4. Toque em **Começar**.

**Tela cheia:** botão ⛶ no canto. No iPhone, abra no Safari e use Compartilhar → **Adicionar à Tela de Início**: o jogo abre como aplicativo, em tela cheia.

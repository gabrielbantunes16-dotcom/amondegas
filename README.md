# Impostor na Nave: servidor

Um serviço só: serve o jogo (public/index.html) e conecta os jogadores por WebSocket.

## Publicar no Render
1. Coloque estes arquivos num repositório do GitHub (na raiz: server.js, package.json, render.yaml, public/).
2. No Render: New > Web Service (https://dashboard.render.com/web/new), conecte o repositório.
3. Configure: Runtime Node, Build Command `npm install`, Start Command `npm start`, Health Check Path `/healthz`.
   (Com o render.yaml, também funciona em New > Blueprint.)
4. Quando terminar o deploy, abra o endereço `https://SEU-SERVICO.onrender.com` e passe o link para os amigos.

Obs.: no plano gratuito o serviço dorme sem uso e a primeira visita pode demorar cerca de um minuto.

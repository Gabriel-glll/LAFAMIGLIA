# Barbearia La Famiglia — site

Site de página única (HTML/CSS/JS puro, sem build) com agendamento online.
Publicado no GitHub Pages: https://gabriel-glll.github.io/LAFAMIGLIA/

Tudo que precisa ser ajustado fica em **`config.js`** (WhatsApp, serviços, preços, horários, barbeiros, chaves).

---

## Como o agendamento funciona

- Horários de **40 em 40 minutos**, gerados a partir do horário de funcionamento (`funcionamento` no config).
- Janela de **~2 meses**: semana atual + 8 semanas. Toda **segunda-feira** uma semana nova é liberada sozinha.
- Quando um cliente confirma, o horário **some na hora para todo mundo** (tempo real). O banco recusa uma segunda reserva no mesmo horário, mesmo que duas pessoas cliquem ao mesmo tempo.
- Horários que já passaram ficam bloqueados automaticamente.
- **Barbeiro é avisado no WhatsApp** (CallMeBot) com um link pra confirmar com o cliente em um toque.
- **Cliente** vê a confirmação na tela, pode mandar o agendamento no WhatsApp da barbearia e salvar o lembrete no Google Agenda ou no celular.
- Cliente pode escolher "Qualquer um": o sistema coloca com o barbeiro livre que tem menos clientes no dia.
- **Área do barbeiro** (link no rodapé ou `.../LAFAMIGLIA/#admin`): ver próximos agendamentos, cancelar (o horário volta a ficar livre), chamar o cliente no WhatsApp e bloquear horários (folga, almoço).

Enquanto o Firebase não estiver configurado o site roda em **modo demonstração** (faixa amarela no topo; salva só no navegador; senha da área do barbeiro: `famiglia`).

---

## PASSO 1 — Firebase (banco dos agendamentos) — grátis

1. Acesse https://console.firebase.google.com → **Adicionar projeto** → nome `lafamiglia` (pode desativar o Analytics).
2. **Firestore Database** → Criar banco → modo **produção** → local `southamerica-east1`.
3. Aba **Regras** → apague tudo, cole o conteúdo de `firestore.rules` e **troque os e-mails** em `isAdmin()` pelos e-mails dos barbeiros → Publicar.
4. **Authentication** → Começar → **E-mail/senha** → ativar. Aba **Usuários** → Adicionar usuário: crie um login para o Arnaldo e um para o Miqueias (mesmos e-mails das regras).
5. Engrenagem ⚙️ → Configurações do projeto → **Seus apps** → ícone `</>` (Web) → registrar → copie o `firebaseConfig` e cole em `CONFIG.firebase` no `config.js`.
6. Authentication → Configurações → **Domínios autorizados** → adicionar `gabriel-glll.github.io`.

## PASSO 2 — Aviso no WhatsApp do barbeiro (CallMeBot, grátis)

Cada barbeiro faz isso UMA vez, no próprio celular:
1. Salve o contato **+34 644 99 26 98** (CallMeBot).
2. Mande pelo WhatsApp para ele a mensagem: `I allow callmebot to send me messages`
3. Em até 2 minutos chega a resposta com a **APIKEY** (um número).
4. Preencha no `config.js`, no barbeiro: `whatsapp: "5519..."` e `callmebot: "APIKEY"`.

A cada agendamento o barbeiro recebe no WhatsApp: nome, serviço, dia, hora, WhatsApp do cliente e um **link pra confirmar com o cliente em um toque**.

> Opcional: app **ntfy** para receber também como notificação push (campo `ntfy` no config).

## PASSO 3 — Ajustes de conteúdo

- `config.js`: **WhatsApp real da barbearia**, preços, serviços, horários.
- Fotos: coloque `arnaldo.jpg` e `miqueias.jpg` na pasta `img/` (formato quadrado/retrato). Enquanto não houver foto aparece a inicial estilizada.
- Textos das seções: direto no `index.html`.

Depois de qualquer alteração: `git add . && git commit -m "..." && git push` — o GitHub Pages atualiza em ~1 minuto.

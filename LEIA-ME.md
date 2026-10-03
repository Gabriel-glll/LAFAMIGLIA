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
- **Barbeiro é avisado** por notificação no celular (app ntfy) e, se configurado, por e-mail.
- **Cliente recebe** a confirmação na tela + botão para Google Agenda / lembrete .ics (alarme 2h antes) + e-mail (se configurado). O barbeiro também tem um botão pronto para mandar a confirmação no WhatsApp do cliente.
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

## PASSO 2 — Notificação no celular do barbeiro (ntfy) — grátis, sem cadastro

1. Cada barbeiro instala o app **ntfy** (Android/iPhone).
2. No app: **+** → "Subscribe to topic" → digite o tópico dele que está no `config.js`
   (`lafamiglia-arnaldo-7x9k2` / `lafamiglia-miqueias-4p8w1`).
3. Pronto: a cada agendamento chega uma notificação com nome, serviço, dia, hora e WhatsApp do cliente.

> O nome do tópico funciona como uma senha: quem souber o nome consegue ler os avisos. Se quiser, troque por outro nome difícil no `config.js` e no app.

## PASSO 3 (opcional) — E-mail para cliente e barbeiro (EmailJS, 200 e-mails/mês grátis)

1. Crie conta em https://www.emailjs.com → **Email Services** → conecte o Gmail da barbearia → anote o **Service ID**.
2. **Email Templates** → Create → em "To Email" coloque `{{to_email}}`, assunto `{{assunto}}` e no corpo `{{mensagem}}` → anote o **Template ID**.
3. **Account** → copie a **Public Key**.
4. Preencha `CONFIG.emailjs` no `config.js` e o campo `email` de cada barbeiro.

## PASSO 4 — Ajustes de conteúdo

- `config.js`: **WhatsApp real da barbearia**, preços, serviços, horários.
- Fotos: coloque `arnaldo.jpg` e `miqueias.jpg` na pasta `img/` (formato quadrado/retrato). Enquanto não houver foto aparece a inicial estilizada.
- Textos das seções: direto no `index.html`.

Depois de qualquer alteração: `git add . && git commit -m "..." && git push` — o GitHub Pages atualiza em ~1 minuto.

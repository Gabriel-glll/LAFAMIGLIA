// =====================================================================
//  LA FAMIGLIA — CONFIGURAÇÃO
//  Tudo que a barbearia precisa ajustar fica aqui. Veja o LEIA-ME.md.
// =====================================================================

export const CONFIG = {
  // WhatsApp da barbearia (só números, com 55 + DDD). Usado nos botões de contato.
  whatsapp: "5519999999999",
  instagram: "https://www.instagram.com/barbearialafamigliaa/",
  endereco: "R. Mário Paijão, 231, Jd. Bom Retiro, Sumaré SP",

  // Barbeiros que atendem pelo agendamento.
  // whatsapp + callmebot: o barbeiro recebe cada agendamento no próprio WhatsApp (veja o LEIA-ME).
  // ntfy (opcional): tópico do app ntfy, pra receber também como notificação push.
  barbeiros: [
    { id: "arnaldo", nome: "Arnaldo", papel: "Fundador · especialista em cortes", whatsapp: "", callmebot: "", ntfy: "" },
    { id: "miqueias", nome: "Miqueias", papel: "Barbeiro · o mais novo da família", whatsapp: "", callmebot: "", ntfy: "" },
  ],

  // Serviços (cada agendamento ocupa um horário de 40 min).
  servicos: [
    { id: "corte", nome: "Corte", preco: 40, desc: "Do clássico ao degradê, feito na conversa." },
    { id: "barba", nome: "Barba", preco: 30, desc: "Toalha quente, navalha e acabamento." },
    { id: "combo", nome: "Corte + Barba", preco: 65, desc: "O pacote completo da família." },
    { id: "pezinho", nome: "Pezinho / Acabamento", preco: 20, desc: "Aquele retoque entre um corte e outro." },
    { id: "sobrancelha", nome: "Sobrancelha", preco: 15, desc: "Na navalha, discreta e alinhada." },
    { id: "infantil", nome: "Corte Infantil", preco: 35, desc: "Os pequenos da família também têm cadeira." },
  ],

  // Horário de funcionamento por dia da semana (0 = domingo ... 6 = sábado).
  // null = fechado. Os horários são gerados de 40 em 40 minutos.
  intervaloMin: 40,
  funcionamento: {
    0: null,
    1: null,
    2: ["09:00", "20:00"],
    3: ["09:00", "20:00"],
    4: ["09:00", "20:00"],
    5: ["09:00", "20:00"],
    6: ["08:00", "17:00"],
  },

  // Janela de agendamento: semana atual + 8 semanas (~2 meses).
  // Toda segunda-feira uma semana nova é liberada automaticamente.
  semanasAFrente: 9,

  // ---------- FIREBASE (banco de dados dos agendamentos) ----------
  // Cole aqui o firebaseConfig do seu projeto. Enquanto apiKey estiver vazio,
  // o site roda em MODO DEMONSTRAÇÃO (salva só no navegador).
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: "",
  },
};

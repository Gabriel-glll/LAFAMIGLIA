import { CONFIG } from "./config.js";

// =====================================================================
//  Utilidades
// =====================================================================
const $ = (s, el = document) => el.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const paraMin = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
const deMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const real = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const slotId = (barbeiro, data, hora) => `${barbeiro}_${data}_${hora.replace(":", "")}`;
const soDigitos = (s) => (s || "").replace(/\D/g, "");
const foneWa = (s) => { const d = soDigitos(s); return d.length <= 11 ? "55" + d : d; };
const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dataLonga = (s) => deIso(s).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).replace("-feira", "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function toast(msg, ms = 3200) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("on"), ms);
}

// Janela de agendamento: de hoje até o fim da semana (segunda→domingo) atual + N semanas.
// Como conta a partir da segunda-feira da semana atual, toda segunda uma semana nova abre.
function janela() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const segunda = new Date(hoje); segunda.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
  const fim = new Date(segunda); fim.setDate(segunda.getDate() + CONFIG.semanasAFrente * 7 - 1);
  return { hoje, fim };
}

function horariosDoDia(data) {
  const f = CONFIG.funcionamento[data.getDay()];
  if (!f) return [];
  const [ini, fim] = f.map(paraMin);
  const out = [];
  for (let m = ini; m + CONFIG.intervaloMin <= fim; m += CONFIG.intervaloMin) out.push(deMin(m));
  return out;
}

function horaPassou(dataStr, hora) {
  const agora = new Date();
  if (dataStr !== iso(agora)) return dataStr < iso(agora);
  return paraMin(hora) <= agora.getHours() * 60 + agora.getMinutes();
}

// =====================================================================
//  Camada de dados — Firebase (produção) ou localStorage (demonstração)
//  slots/{id}         → público: só diz que o horário está ocupado
//  agendamentos/{id}  → privado: dados do cliente, só o barbeiro lê
// =====================================================================
const MODO_DEMO = !CONFIG.firebase.apiKey;

function criarStoreLocal() {
  const K_SLOTS = "lf_slots", K_AG = "lf_agendamentos", K_ADM = "lf_admin";
  const ler = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
  const gravar = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const ouvintes = new Set();
  const avisar = () => ouvintes.forEach((f) => f());
  window.addEventListener("storage", avisar);
  return {
    observarSlots(desde, cb) {
      const f = () => cb(Object.fromEntries(Object.entries(ler(K_SLOTS)).filter(([, s]) => s.data >= desde)));
      ouvintes.add(f); f();
    },
    async reservar(ag) {
      const slots = ler(K_SLOTS);
      if (slots[ag.id]) throw new Error("ocupado");
      slots[ag.id] = { barbeiro: ag.barbeiro, data: ag.data, hora: ag.hora, tipo: "reserva" };
      const ags = ler(K_AG); ags[ag.id] = ag;
      gravar(K_SLOTS, slots); gravar(K_AG, ags); avisar();
    },
    async entrar(email, senha) {
      if (senha !== "famiglia") throw new Error("Senha do modo demonstração: famiglia");
      localStorage.setItem(K_ADM, email); avisar();
    },
    async sair() { localStorage.removeItem(K_ADM); avisar(); },
    observarAdmin(cb) { const f = () => cb(!!localStorage.getItem(K_ADM)); ouvintes.add(f); f(); },
    observarAgendamentos(desde, cb) {
      const f = () => cb(Object.values(ler(K_AG)).filter((a) => a.data >= desde));
      ouvintes.add(f); f();
    },
    async cancelar(id) {
      const s = ler(K_SLOTS), a = ler(K_AG);
      delete s[id]; delete a[id]; gravar(K_SLOTS, s); gravar(K_AG, a); avisar();
    },
    async bloquear(id, barbeiro, data, hora) {
      const s = ler(K_SLOTS);
      if (s[id]) throw new Error("ocupado");
      s[id] = { barbeiro, data, hora, tipo: "bloqueio" }; gravar(K_SLOTS, s); avisar();
    },
    async liberar(id) { const s = ler(K_SLOTS); delete s[id]; gravar(K_SLOTS, s); avisar(); },
  };
}

async function criarStoreFirebase() {
  const V = "10.12.2";
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const au = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const app = initializeApp(CONFIG.firebase);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  const slotRef = (id) => fs.doc(db, "slots", id);
  const agRef = (id) => fs.doc(db, "agendamentos", id);
  let pararAg = null;

  return {
    observarSlots(desde, cb) {
      fs.onSnapshot(fs.query(fs.collection(db, "slots"), fs.where("data", ">=", desde)), (snap) => {
        const out = {}; snap.forEach((d) => (out[d.id] = d.data())); cb(out);
      }, (e) => { console.error(e); toast("Não foi possível carregar a agenda. Recarregue a página."); });
    },
    async reservar(ag) {
      try {
        await fs.runTransaction(db, async (tx) => {
          const s = await tx.get(slotRef(ag.id));
          if (s.exists()) throw new Error("ocupado");
          tx.set(slotRef(ag.id), { barbeiro: ag.barbeiro, data: ag.data, hora: ag.hora, tipo: "reserva" });
          tx.set(agRef(ag.id), { ...ag, criadoEm: fs.serverTimestamp() });
        });
      } catch (e) {
        // Se outra pessoa reservou no mesmo instante, as regras do Firestore negam a escrita.
        if (e.message === "ocupado" || e.code === "permission-denied") throw new Error("ocupado");
        throw e;
      }
    },
    async entrar(email, senha) { await au.signInWithEmailAndPassword(auth, email, senha); },
    async sair() { if (pararAg) pararAg(); await au.signOut(auth); },
    observarAdmin(cb) { au.onAuthStateChanged(auth, (u) => cb(!!u)); },
    observarAgendamentos(desde, cb) {
      if (pararAg) pararAg();
      pararAg = fs.onSnapshot(fs.query(fs.collection(db, "agendamentos"), fs.where("data", ">=", desde)), (snap) => {
        cb(snap.docs.map((d) => d.data()));
      }, (e) => { console.error(e); toast("Sem permissão para ver os agendamentos. Confira o email nas regras do Firestore."); });
    },
    async cancelar(id) {
      const b = fs.writeBatch(db); b.delete(slotRef(id)); b.delete(agRef(id)); await b.commit();
    },
    async bloquear(id, barbeiro, data, hora) {
      await fs.setDoc(slotRef(id), { barbeiro, data, hora, tipo: "bloqueio" });
    },
    async liberar(id) { await fs.deleteDoc(slotRef(id)); },
  };
}

// =====================================================================
//  Notificações
// =====================================================================
function textoAgendamento(ag) {
  return `${ag.servicoNome} com ${ag.barbeiroNome}\n${dataLonga(ag.data)} às ${ag.hora}`;
}

async function notificar(ag) {
  const barbeiro = CONFIG.barbeiros.find((b) => b.id === ag.barbeiro);
  if (!barbeiro) return;
  // Link pronto pro barbeiro confirmar com o cliente em um toque
  const confirmar = `https://wa.me/${foneWa(ag.whats)}?text=${encodeURIComponent(`Fala, ${ag.nome}! Aqui é o ${barbeiro.nome} da La Famiglia. Seu horário está confirmado: ${ag.servicoNome}, ${dataLonga(ag.data)} às ${ag.hora}. Te esperamos!`)}`;
  const texto = `✂️ *Novo agendamento*\n\n*${ag.nome}*\n${ag.servicoNome}\n${maiuscula(dataLonga(ag.data))} às *${ag.hora}*\nWhatsApp: ${ag.whats}${ag.obs ? `\nObs.: ${ag.obs}` : ""}\n\nConfirmar com o cliente: ${confirmar}`;
  const tarefas = [];

  // 1) WhatsApp do barbeiro (CallMeBot, grátis)
  if (barbeiro.whatsapp && barbeiro.callmebot) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${soDigitos(barbeiro.whatsapp)}&apikey=${encodeURIComponent(barbeiro.callmebot)}&text=${encodeURIComponent(texto)}`;
    tarefas.push(fetch(url, { mode: "no-cors" }));
  }
  // 2) Push no celular (app ntfy), opcional
  if (barbeiro.ntfy) {
    tarefas.push(fetch("https://ntfy.sh/", {
      method: "POST",
      body: JSON.stringify({ topic: barbeiro.ntfy, title: `✂️ Novo agendamento: ${ag.nome}`, message: texto.replace(/\*/g, ""), priority: 4, click: confirmar }),
    }));
  }
  const res = await Promise.allSettled(tarefas);
  res.filter((r) => r.status === "rejected").forEach((r) => console.warn("Falha ao notificar:", r.reason));
}

function linkGoogleAgenda(ag) {
  const ini = deIso(ag.data); const [h, m] = ag.hora.split(":").map(Number); ini.setHours(h, m);
  const fim = new Date(ini.getTime() + CONFIG.intervaloMin * 60000);
  const f = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const p = new URLSearchParams({
    action: "TEMPLATE", text: `${ag.servicoNome} na La Famiglia`, dates: `${f(ini)}/${f(fim)}`,
    ctz: "America/Sao_Paulo", details: `Com ${ag.barbeiroNome}. Chega um pouquinho antes pro café!`, location: CONFIG.endereco,
  });
  return { url: `https://calendar.google.com/calendar/render?${p}`, ini: f(ini), fim: f(fim) };
}

function arquivoIcs(ag) {
  const { ini, fim } = linkGoogleAgenda(ag);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//La Famiglia//Agenda//PT",
    "BEGIN:VEVENT", `UID:${ag.id}@lafamiglia`, `DTSTAMP:${ini}`,
    `DTSTART;TZID=America/Sao_Paulo:${ini}`, `DTEND;TZID=America/Sao_Paulo:${fim}`,
    `SUMMARY:${ag.servicoNome} na La Famiglia`, `DESCRIPTION:Com ${ag.barbeiroNome}`, `LOCATION:${CONFIG.endereco.replace(/,/g, "\\,")}`,
    "BEGIN:VALARM", "TRIGGER:-PT2H", "ACTION:DISPLAY", "DESCRIPTION:Seu horário na La Famiglia", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
}

// =====================================================================
//  Conteúdo institucional
// =====================================================================
function montarConteudo() {
  $("#lista-precos").innerHTML = CONFIG.servicos.map((s) => `
    <li><span class="p-nome">${esc(s.nome)}<span class="p-desc">${esc(s.desc)}</span></span>
    <span class="p-ponto"></span><span class="p-valor">${real(s.preco)}</span></li>`).join("");

  $("#equipe-grid").innerHTML = CONFIG.barbeiros.map((b) => `
    <article class="membro">
      <figure class="foto-moldura">
        <img src="img/${b.id}.jpg" alt="${esc(b.nome)}" onerror="this.remove()" />
        <div class="foto-fallback" aria-hidden="true"><span>${esc(b.nome[0])}</span></div>
      </figure>
      <div class="membro-info"><h3>${esc(b.nome)}</h3><p>${esc(b.papel)}</p></div>
    </article>`).join("");

  // Agrupa dias com o mesmo horário: "Terça a Sexta"
  const linhas = [];
  for (let i = 1; i <= 7; i++) {
    const d = i % 7, f = CONFIG.funcionamento[d], txt = f ? `${f[0]} às ${f[1]}` : "Fechado";
    const ult = linhas[linhas.length - 1];
    if (ult && ult.txt === txt) ult.fim = d; else linhas.push({ ini: d, fim: d, txt });
  }
  $("#horario").innerHTML = linhas.map((l) =>
    `<div><span>${DIAS[l.ini]}${l.fim !== l.ini ? ` a ${DIAS[l.fim]}` : ""}</span><b>${l.txt}</b></div>`).join("");

  $("#endereco").textContent = CONFIG.endereco;
  $("#mapa").src = `https://www.google.com/maps?q=${encodeURIComponent(CONFIG.endereco)}&output=embed`;
  const wa = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent("Fala, La Famiglia! Vim pelo site.")}`;
  $("#link-whats").href = wa;
  $("#link-trabalhe").href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent("Fala, Arnaldo! Sou barbeiro e quero fazer parte da família La Famiglia.")}`;
  $("#link-insta").href = $("#link-insta2").href = CONFIG.instagram;
  $("#ano").textContent = new Date().getFullYear();
}

function montarInteracoes() {
  // Duplica as fotos para o carrossel rodar sem emenda
  const trilho = $("#galeria-trilho");
  [...trilho.children].forEach((img) => { const c = img.cloneNode(); c.alt = ""; c.setAttribute("aria-hidden", "true"); trilho.append(c); });

  const btn = $("#menu-btn"), menu = $("#menu");
  btn.addEventListener("click", () => {
    const aberto = menu.classList.toggle("aberto");
    btn.setAttribute("aria-expanded", aberto);
  });
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) { menu.classList.remove("aberto"); btn.setAttribute("aria-expanded", false); } });

  document.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));

  const alvos = document.querySelectorAll(".titulo, .lead, .pilar, .precos li, .membro, .foto-moldura, .citacao, .agenda, .mapa");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); } }), { threshold: .12 });
    alvos.forEach((el) => { el.classList.add("revela"); io.observe(el); });
  }
}

// =====================================================================
//  Agendamento
// =====================================================================
const estado = { servico: CONFIG.servicos[0]?.id, barbeiro: "qualquer", data: null, hora: null, mes: null, slots: {} };
let store;

function ocupado(barbeiro, data, hora) { return !!estado.slots[slotId(barbeiro, data, hora)]; }

// Barbeiros livres naquele horário (respeitando a escolha do cliente)
function barbeirosLivres(data, hora) {
  if (horaPassou(data, hora)) return [];
  const lista = estado.barbeiro === "qualquer" ? CONFIG.barbeiros : CONFIG.barbeiros.filter((b) => b.id === estado.barbeiro);
  return lista.filter((b) => !ocupado(b.id, data, hora));
}

function horasLivres(data) { return horariosDoDia(deIso(data)).filter((h) => barbeirosLivres(data, h).length); }

// "Qualquer um": fica com o barbeiro que tem menos clientes no dia
function escolherBarbeiro(data, hora) {
  const carga = (b) => horariosDoDia(deIso(data)).filter((h) => ocupado(b.id, data, h)).length;
  return barbeirosLivres(data, hora).sort((a, b) => carga(a) - carga(b))[0];
}

function chip(texto, sub, ativo, onclick) {
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", ativo);
  b.innerHTML = `${esc(texto)}${sub ? `<small>${esc(sub)}</small>` : ""}`;
  b.addEventListener("click", onclick);
  return b;
}

function renderChips() {
  const cs = $("#chips-servico"); cs.replaceChildren();
  CONFIG.servicos.forEach((s) => cs.append(chip(s.nome, real(s.preco), estado.servico === s.id, () => { estado.servico = s.id; renderTudo(); })));
  const cb = $("#chips-barbeiro"); cb.replaceChildren();
  [{ id: "qualquer", nome: "Qualquer um", sub: "o primeiro livre" }, ...CONFIG.barbeiros].forEach((b) =>
    cb.append(chip(b.nome, b.sub, estado.barbeiro === b.id, () => {
      estado.barbeiro = b.id; estado.hora = null; renderTudo();
    })));
}

function renderCalendario() {
  const { hoje, fim } = janela();
  if (!estado.mes) estado.mes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const m = estado.mes;
  $("#cal-mes").textContent = maiuscula(m.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
  $("#cal-prev").disabled = m <= new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  $("#cal-next").disabled = new Date(m.getFullYear(), m.getMonth() + 1, 1) > fim;

  const grade = $("#cal-dias"); grade.replaceChildren();
  for (let i = 0; i < m.getDay(); i++) grade.append(document.createElement("span"));
  const nDias = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= nDias; d++) {
    const data = new Date(m.getFullYear(), m.getMonth(), d), s = iso(data);
    const b = document.createElement("button");
    b.type = "button"; b.className = "dia"; b.textContent = d;
    const aberto = data >= hoje && data <= fim && horariosDoDia(data).length > 0;
    b.disabled = !aberto;
    if (aberto && !horasLivres(s).length) { b.classList.add("lotado"); b.title = "Sem horários livres"; }
    if (s === iso(hoje)) b.classList.add("hoje");
    b.setAttribute("aria-pressed", estado.data === s);
    b.addEventListener("click", () => {
      estado.data = s; estado.hora = null; renderTudo();
      if (matchMedia("(max-width: 900px)").matches) $("#p-hora").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    grade.append(b);
  }
  $("#cal-nota").textContent = `Agenda aberta até ${fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}. Toda segunda libera mais uma semana.`;
}

function renderHoras() {
  const box = $("#horas"); box.replaceChildren();
  $("#hora-dia").textContent = estado.data ? deIso(estado.data).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }) : "";
  if (!estado.data) { box.innerHTML = `<p class="vazio">Toque em um dia do calendário e os horários livres aparecem aqui.</p>`; return; }
  const livres = horasLivres(estado.data);
  if (!livres.length) { box.innerHTML = `<p class="vazio">Esse dia já está lotado. Tenta outro dia${estado.barbeiro !== "qualquer" ? " ou outro barbeiro" : ""}.</p>`; return; }
  livres.forEach((h) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "hora"; b.textContent = h;
    b.setAttribute("aria-pressed", estado.hora === h);
    b.addEventListener("click", () => {
      estado.hora = h; renderTudo();
      $("#form-agenda").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    box.append(b);
  });
}

function renderResumo() {
  const s = CONFIG.servicos.find((x) => x.id === estado.servico);
  const pronto = !!(s && estado.data && estado.hora);
  $("#form-agenda").hidden = !pronto;
  if (!pronto) return;
  const b = estado.barbeiro === "qualquer" ? null : CONFIG.barbeiros.find((x) => x.id === estado.barbeiro);
  $("#resumo").innerHTML = `<b>${esc(s.nome)}</b> · ${real(s.preco)}<br>${maiuscula(dataLonga(estado.data))} às <b>${estado.hora}</b>${b ? ` com <b>${esc(b.nome)}</b>` : ""}`;
  $("#btn-confirmar").disabled = false;
}

function renderTudo() { renderChips(); renderCalendario(); renderHoras(); renderResumo(); }

function montarAgenda() {
  $("#cal-prev").addEventListener("click", () => { estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() - 1, 1); renderCalendario(); });
  $("#cal-next").addEventListener("click", () => { estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + 1, 1); renderCalendario(); });

  const form = $("#form-agenda");
  form.whats.addEventListener("input", () => {
    const d = soDigitos(form.whats.value).slice(0, 11);
    form.whats.value = d.length > 6 ? `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)} ${d.slice(-4)}` : d.length > 2 ? `(${d.slice(0, 2)}) ${d.slice(2)}` : d;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const erro = $("#erro-form"); erro.textContent = "";
    const nome = form.nome.value.trim(), whats = form.whats.value.trim(), obs = form.obs.value.trim();
    if (nome.length < 2) return (erro.textContent = "Coloca seu nome pra gente te chamar certo.");
    if (soDigitos(whats).length < 10) return (erro.textContent = "Confere o WhatsApp com DDD.");
    if (horaPassou(estado.data, estado.hora)) return (erro.textContent = "Esse horário já passou. Escolhe outro.");

    const s = CONFIG.servicos.find((x) => x.id === estado.servico);
    const b = escolherBarbeiro(estado.data, estado.hora);
    if (!b) { estado.hora = null; renderTudo(); return toast("Esse horário acabou de ser reservado. Escolhe outro!"); }
    const ag = {
      id: slotId(b.id, estado.data, estado.hora),
      barbeiro: b.id, barbeiroNome: b.nome, servico: s.id, servicoNome: s.nome, preco: s.preco,
      data: estado.data, hora: estado.hora, nome, whats, obs,
    };

    const btn = $("#btn-confirmar");
    btn.disabled = true; btn.textContent = "Reservando…";
    try {
      await store.reservar(ag);
    } catch (err) {
      btn.textContent = "Confirmar agendamento";
      if (err.message === "ocupado") {
        estado.hora = null; renderTudo();
        toast("Poxa, alguém da família acabou de pegar esse horário. Escolhe outro!");
      } else {
        console.error(err); renderResumo();
        erro.textContent = "Não deu pra salvar agora. Verifique sua internet e tente de novo.";
      }
      return;
    }
    btn.textContent = "Confirmar agendamento";
    notificar(ag);
    mostrarConfirmacao(ag);
    form.reset(); estado.hora = null; renderTudo();
  });
}

function mostrarConfirmacao(ag) {
  $("#ok-texto").innerHTML = `<b>${esc(ag.nome)}</b>, sua cadeira está garantida:<br><b class="lime">${esc(ag.servicoNome)}</b> com ${esc(ag.barbeiroNome)}<br>${dataLonga(ag.data)} às <b>${ag.hora}</b>`;
  $("#ok-whats").href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(`Fala, família! Agendei pelo site:\n\n${textoAgendamento(ag)}\nNome: ${ag.nome}\n\nMe confirma por aqui?`)}`;
  $("#ok-gcal").href = linkGoogleAgenda(ag).url;
  const ics = $("#ok-ics"); ics.href = arquivoIcs(ag); ics.download = "la-famiglia.ics";
  $("#modal-ok").showModal();
}

// =====================================================================
//  Área do barbeiro
// =====================================================================
let agendamentos = [];

function montarAdmin() {
  const modal = $("#modal-admin");
  const abrir = (e) => { e?.preventDefault(); modal.showModal(); };
  $("#abrir-admin").addEventListener("click", abrir);
  if (location.hash === "#admin") abrir();

  const sel = $("#adm-barbeiro");
  sel.innerHTML = CONFIG.barbeiros.map((b) => `<option value="${b.id}">${esc(b.nome)}</option>`).join("");
  const { hoje, fim } = janela();
  const dataIn = $("#adm-data");
  dataIn.min = iso(hoje); dataIn.max = iso(fim); dataIn.value = iso(hoje);
  sel.addEventListener("change", renderAdmin);
  dataIn.addEventListener("change", renderAdmin);

  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; $("#erro-login").textContent = "";
    try { await store.entrar(f.email.value.trim(), f.senha.value); f.reset(); }
    catch (err) { $("#erro-login").textContent = MODO_DEMO ? err.message : "Email ou senha incorretos."; }
  });
  $("#btn-sair").addEventListener("click", () => store.sair());

  store.observarAdmin((logado) => {
    $("#form-login").hidden = logado;
    $("#painel").hidden = !logado;
    if (logado) store.observarAgendamentos(iso(janela().hoje), (lista) => { agendamentos = lista; renderAdmin(); });
  });
}

function renderAdmin() {
  if ($("#painel").hidden) return;
  const barbeiro = $("#adm-barbeiro").value;
  const lista = agendamentos.filter((a) => a.barbeiro === barbeiro && !horaPassou(a.data, a.hora))
    .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
  const box = $("#adm-lista"); box.replaceChildren();
  if (!lista.length) box.innerHTML = `<p class="mini">Nenhum agendamento por enquanto.</p>`;
  let diaAtual = "";
  lista.forEach((a) => {
    if (a.data !== diaAtual) { diaAtual = a.data; box.insertAdjacentHTML("beforeend", `<p class="adm-dia">${maiuscula(dataLonga(a.data))}</p>`); }
    const item = document.createElement("div"); item.className = "adm-item";
    const msg = `Fala, ${a.nome}! Aqui é da La Famiglia. Seu horário está confirmado: ${a.servicoNome}, ${dataLonga(a.data)} às ${a.hora}. Te esperamos!`;
    item.innerHTML = `<span><b>${a.hora}</b> · ${esc(a.nome)} · ${esc(a.servicoNome)}${a.obs ? `<br><small>${esc(a.obs)}</small>` : ""}</span>
      <span class="acoes"><a class="btn btn-sm btn-lime" target="_blank" rel="noopener" href="https://wa.me/${foneWa(a.whats)}?text=${encodeURIComponent(msg)}">WhatsApp</a>
      <button class="btn btn-sm btn-ghost">Cancelar</button></span>`;
    item.querySelector("button").addEventListener("click", async () => {
      if (!confirm(`Cancelar o horário de ${a.nome} (${a.data} ${a.hora})? O horário volta a ficar livre.`)) return;
      try { await store.cancelar(a.id); toast("Agendamento cancelado. Avise o cliente no WhatsApp."); }
      catch (e) { console.error(e); toast("Não foi possível cancelar."); }
    });
    box.append(item);
  });

  const data = $("#adm-data").value, grade = $("#adm-horas"); grade.replaceChildren();
  if (!data) return;
  const hs = horariosDoDia(deIso(data));
  if (!hs.length) { grade.innerHTML = `<p class="vazio">Fechado nesse dia.</p>`; return; }
  hs.forEach((h) => {
    const id = slotId(barbeiro, data, h), s = estado.slots[id];
    const b = document.createElement("button"); b.type = "button"; b.className = "hora"; b.textContent = h;
    if (s?.tipo === "reserva") { b.classList.add("reserv"); b.title = "Reservado"; b.disabled = true; }
    else if (s?.tipo === "bloqueio") { b.classList.add("bloq"); b.title = "Bloqueado, toque para liberar"; b.onclick = () => store.liberar(id).catch(() => toast("Erro ao liberar.")); }
    else if (horaPassou(data, h)) { b.disabled = true; }
    else { b.title = "Livre, toque para bloquear"; b.onclick = () => store.bloquear(id, barbeiro, data, h).catch(() => toast("Erro ao bloquear.")); }
    grade.append(b);
  });
}

// =====================================================================
//  Início
// =====================================================================
async function iniciar() {
  montarConteudo();
  montarInteracoes();
  if (MODO_DEMO) $("#demo-banner").hidden = false;
  try { store = MODO_DEMO ? criarStoreLocal() : await criarStoreFirebase(); }
  catch (e) { console.error(e); toast("Erro ao conectar com a agenda."); store = criarStoreLocal(); }

  montarAgenda();
  store.observarSlots(iso(janela().hoje), (slots) => {
    estado.slots = slots;
    if (estado.hora && estado.barbeiro && ocupado(estado.barbeiro, estado.data, estado.hora)) {
      estado.hora = null; toast("O horário que você escolheu acabou de ser reservado. Escolhe outro!");
    }
    renderTudo(); renderAdmin();
  });
  montarAdmin();
  // Atualiza a cada minuto: horários que passaram somem e a janela anda sozinha na virada da semana.
  setInterval(() => { renderTudo(); }, 60000);
}

iniciar();

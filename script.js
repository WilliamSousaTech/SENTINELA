const FIREBASE_BASE = "https://sentinela-a5028-default-rtdb.firebaseio.com";
const SENSOR_URL = `${FIREBASE_BASE}/sensores.json`;
const HISTORY_URL = `${FIREBASE_BASE}/historico.json`;

const OFFLINE_AFTER_MS = 7000;
const HISTORY_LIMIT_DEFAULT = 15;

let state = {
  temperatura: null,
  umidade: null,
  presenca: null,
  estado: null,
  ultimoContato: null,
};

let hardwareOnline = false;
let historyCache = [];
let historyLimit = HISTORY_LIMIT_DEFAULT;
let temperatureChart = null;
let humidityChart = null;

const $ = (id) => document.getElementById(id);

function normalizarEstado(valor) {
  if (!valor) return null;
  const v = String(valor).trim().toUpperCase();
  if (v === "ATENÇÃO" || v === "ATENCAO") return "ATENCAO";
  if (v === "ALERTA" || v === "NORMAL") return v;
  return null;
}

function formatarData(timestamp) {
  if (!timestamp) return "—";
  const data = new Date(Number(timestamp));
  if (Number.isNaN(data.getTime())) return "—";
  return data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function calcularEstado(temp, umid) {
  if (Number(temp) > 35 || Number(umid) < 30) return "ALERTA";
  if (
    (Number(temp) >= 32 && Number(temp) <= 35) ||
    (Number(umid) >= 30 && Number(umid) < 40)
  ) return "ATENCAO";
  return "NORMAL";
}

function atualizarConexao(online) {
  hardwareOnline = online;

  const pill = $("connection-pill");
  const label = $("connection-label");

  pill.classList.toggle("online", online);
  pill.classList.toggle("offline", !online);
  label.textContent = online ? "HARDWARE ONLINE" : "HARDWARE OFFLINE";

  $("offline-panel").classList.toggle("is-hidden", online);
  $("live-content").classList.toggle("is-hidden", !online);

  $("footer-status").textContent = online
    ? "ESP32 comunicando com o Firebase em tempo real"
    : "Nenhuma leitura é exibida enquanto o hardware estiver offline";
}

function atualizarPainel() {
  if (!hardwareOnline) return;

  const temp = Number(state.temperatura);
  const umid = Number(state.umidade);
  const pres = Number(state.presenca) === 1;
  const estado = normalizarEstado(state.estado) || calcularEstado(temp, umid);

  $("temperature-value").textContent = Number.isFinite(temp) ? temp.toFixed(1) : "—";
  $("humidity-value").textContent = Number.isFinite(umid) ? umid.toFixed(1) : "—";

  $("temperature-range").textContent =
    temp > 35 ? "ALERTA" : temp >= 32 ? "ATENÇÃO" : "NORMAL";
  $("humidity-range").textContent =
    umid < 30 ? "ALERTA" : umid < 40 ? "ATENÇÃO" : "NORMAL";

  $("temperature-bar").style.width =
    `${Math.max(0, Math.min(100, temp * 2))}%`;
  $("humidity-bar").style.width =
    `${Math.max(0, Math.min(100, umid))}%`;

  const presenceCard = $("presence-card");
  presenceCard.classList.toggle("detected", pres);
  $("presence-value").textContent = pres ? "DETECTADO" : "VAZIO";
  $("presence-since").textContent = pres ? "movimento ativo" : "sem movimento";

  $("state-chip").textContent = estado === "ATENCAO" ? "ATENÇÃO" : estado;
  $("state-chip").className = `state-chip ${estado.toLowerCase()}`;

  $("state-card").className = `state-card ${estado.toLowerCase()}`;
  $("state-title").textContent = estado === "ATENCAO" ? "ATENÇÃO" : estado;
  $("state-description").textContent =
    estado === "NORMAL"
      ? "Condições dentro da faixa definida pelo SENTINELA."
      : estado === "ATENCAO"
      ? "Uma das variáveis entrou na faixa de atenção."
      : "Temperatura ou umidade atingiu a faixa de alerta.";

  document.querySelectorAll(".led").forEach((led) => {
    led.classList.toggle(
      "active-normal",
      led.dataset.led === "NORMAL" && estado === "NORMAL"
    );
    led.classList.toggle(
      "active-atencao",
      led.dataset.led === "ATENCAO" && estado === "ATENCAO"
    );
    led.classList.toggle(
      "active-alerta",
      led.dataset.led === "ALERTA" && estado === "ALERTA"
    );
  });

  $("last-seen").textContent = formatarData(state.ultimoContato);
}

function processarSensorData(payload) {
  if (!payload || typeof payload !== "object") return;

  for (const [key, value] of Object.entries(payload)) {
    if (
      ["temperatura", "umidade", "presenca", "estado", "ultimoContato"].includes(key)
    ) {
      state[key] = value;
    }
  }

  atualizarConexao(true);
  atualizarPainel();
}

function conectarStreamSensores() {
  const source = new EventSource(SENSOR_URL);

  source.addEventListener("put", (event) => {
    try {
      const body = JSON.parse(event.data);
      const path = body.path || "/";

      if (path === "/") {
        processarSensorData(body.data);
      } else {
        const key = path.replace(/^//, "");
        state[key] = body.data;
        atualizarConexao(true);
        atualizarPainel();
      }
    } catch (error) {
      console.error("Erro no evento put:", error);
    }
  });

  source.addEventListener("patch", (event) => {
    try {
      const body = JSON.parse(event.data);
      const path = body.path || "/";

      if (path === "/") {
        processarSensorData(body.data);
      } else {
        const key = path.replace(/^//, "");
        state[key] = body.data;
        atualizarConexao(true);
        atualizarPainel();
      }
    } catch (error) {
      console.error("Erro no evento patch:", error);
    }
  });

  source.onerror = () => {
    console.warn("Stream Firebase temporariamente indisponível.");
  };
}

async function carregarEstadoInicial() {
  try {
    const response = await fetch(SENSOR_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const dados = await response.json();
    if (dados) processarSensorData(dados);
  } catch (error) {
    console.error("Não foi possível carregar sensores:", error);
  }
}

async function carregarHistorico() {
  try {
    const response = await fetch(HISTORY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const dados = await response.json();

    if (!dados || typeof dados !== "object") {
      historyCache = [];
      $("history-empty").classList.remove("is-hidden");
      renderCharts();
      return;
    }

    historyCache = Object.entries(dados)
      .map(([key, record]) => ({
        key,
        ...(record || {}),
        timestamp: Number(record?.timestamp ?? record?.ultimoContato ?? 0),
      }))
      .filter(
        (record) =>
          Number.isFinite(Number(record.temperatura)) &&
          Number.isFinite(Number(record.umidade))
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    $("history-empty").classList.toggle("is-hidden", historyCache.length > 0);
    renderCharts();
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
    historyCache = [];
    $("history-empty").classList.remove("is-hidden");
    renderCharts();
  }
}

function criarOpcoesGrafico(label, unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        displayColors: false,
        callbacks: {
          label: (ctx) =>
            `${label}: ${Number(ctx.parsed.y).toFixed(1)} ${unit}`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#75877a",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
          font: { family: "DM Mono" },
        },
        grid: { color: "rgba(117,135,122,.08)" },
      },
      y: {
        ticks: { color: "#75877a", font: { family: "DM Mono" } },
        grid: { color: "rgba(117,135,122,.08)" },
      },
    },
  };
}

function prepararPontos() {
  const recortes = historyCache.slice(-historyLimit);

  return {
    labels: recortes.map((r, i) =>
      Number.isFinite(r.timestamp) && r.timestamp > 0
        ? formatarData(r.timestamp)
        : `Coleta ${i + 1}`
    ),
    temps: recortes.map((r) => Number(r.temperatura)),
    umids: recortes.map((r) => Number(r.umidade)),
  };
}

function renderCharts() {
  const { labels, temps, umids } = prepararPontos();

  const datasetBase = {
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.32,
    fill: true,
  };

  if (!temperatureChart) {
    temperatureChart = new Chart($("temperatureChart"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            ...datasetBase,
            label: "Temperatura",
            data: temps,
            borderColor: "#27e27b",
            backgroundColor: "rgba(39,226,123,.10)",
          },
        ],
      },
      options: criarOpcoesGrafico("Temperatura", "°C"),
    });
  } else {
    temperatureChart.data.labels = labels;
    temperatureChart.data.datasets[0].data = temps;
    temperatureChart.update("none");
  }

  if (!humidityChart) {
    humidityChart = new Chart($("humidityChart"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            ...datasetBase,
            label: "Umidade",
            data: umids,
            borderColor: "#58a8ff",
            backgroundColor: "rgba(88,168,255,.08)",
          },
        ],
      },
      options: criarOpcoesGrafico("Umidade", "%"),
    });
  } else {
    humidityChart.data.labels = labels;
    humidityChart.data.datasets[0].data = umids;
    humidityChart.update("none");
  }
}

function verificarHardware() {
  const contato = Number(state.ultimoContato);

  // Sem heartbeat, não mostramos valores antigos.
  const online =
    Number.isFinite(contato) &&
    contato > 0 &&
    Date.now() - contato <= OFFLINE_AFTER_MS;

  atualizarConexao(online);

  if (!online) {
    $("state-chip").textContent = "SEM DADOS";
    $("state-chip").className = "state-chip";
    $("last-seen").textContent = contato > 0 ? formatarData(contato) : "—";
  }
}

function configurarNavegacao() {
  const links = document.querySelectorAll(".nav-link");
  const sections = [
    document.querySelector("#monitor"),
    document.querySelector("#historico"),
  ];

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) =>
          link.classList.toggle(
            "active",
            link.getAttribute("href") === `#${entry.target.id}`
          )
        );
      });
    },
    { threshold: 0.35 }
  );

  sections.forEach((section) => section && observer.observe(section));
}

function configurarFiltros() {
  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      historyLimit = Number(button.dataset.range);
      renderCharts();
    });
  });
}

window.addEventListener("load", async () => {
  configurarNavegacao();
  configurarFiltros();

  atualizarConexao(false);
  verificarHardware();

  await carregarEstadoInicial();
  await carregarHistorico();

  conectarStreamSensores();

  setInterval(verificarHardware, 1000);
  setInterval(carregarHistorico, 10000);
});
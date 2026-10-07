const FIREBASE_BASE = "https://sentinela-a5028-default-rtdb.firebaseio.com";
const SENSOR_URL = `${FIREBASE_BASE}/sensores.json`;
const HISTORY_URL = `${FIREBASE_BASE}/historico.json`;

const OFFLINE_AFTER_MS = 9000;
const HISTORY_POLL_MS = 2000;
const SENSOR_POLL_MS = 3000;

let state = {
  temperatura: null,
  umidade: null,
  presenca: null,
  estado: null,
  ultimoContato: null,
};

let hardwareOnline = false;
let lastLiveActivity = 0;
let lastHistoryKey = null;
let historyCache = [];
let historyLimit = 15;
let temperatureChart = null;
let humidityChart = null;
let primeiraCargaHistorico = true;

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

function formatarUltimoContato(timestamp) {
  return formatarData(timestamp);
}

function calcularEstado(temp, umid) {
  if (Number(temp) > 35 || Number(umid) < 30) return "ALERTA";
  if (
    (Number(temp) >= 32 && Number(temp) <= 35) ||
    (Number(umid) >= 30 && Number(umid) < 40)
  ) return "ATENCAO";
  return "NORMAL";
}

function registrarAtividadeAoVivo(registro, origem) {
  if (!registro || typeof registro !== "object") return;

  const temp = Number(registro.temperatura);
  const umid = Number(registro.umidade);
  const pres = Number(registro.presenca);

  if (Number.isFinite(temp)) state.temperatura = temp;
  if (Number.isFinite(umid)) state.umidade = umid;
  if (Number.isFinite(pres)) state.presenca = pres;

  const estado = normalizarEstado(registro.estado);
  if (estado) state.estado = estado;

  state.ultimoContato = Date.now();
  lastLiveActivity = Date.now();

  atualizarConexao(true);
  atualizarPainel();

  console.debug("Atividade do circuito:", origem, registro);
}

function atualizarConexao(online) {
  hardwareOnline = online;

  const pill = $("connection-pill");
  const label = $("connection-label");

  pill.classList.toggle("online", online);
  pill.classList.toggle("offline", !online);

  label.textContent = online
    ? "HARDWARE ONLINE"
    : "HARDWARE OFFLINE";

  $("offline-panel").classList.toggle(
    "is-hidden",
    online
  );

  $("live-content").classList.toggle(
    "is-hidden",
    !online
  );

  $("footer-status").textContent = online
    ? "ESP32 comunicando com o Firebase"
    : "Nenhuma leitura é exibida enquanto o hardware estiver offline";
}

function atualizarPainel() {
  if (!hardwareOnline) return;

  const temp = Number(state.temperatura);
  const umid = Number(state.umidade);
  const pres = Number(state.presenca) === 1;

  const estado =
    normalizarEstado(state.estado) ||
    (Number.isFinite(temp) && Number.isFinite(umid)
      ? calcularEstado(temp, umid)
      : null);

  $("temperature-value").textContent =
    Number.isFinite(temp) ? temp.toFixed(1) : "—";

  $("humidity-value").textContent =
    Number.isFinite(umid) ? umid.toFixed(1) : "—";

  $("temperature-range").textContent =
    Number.isFinite(temp)
      ? temp > 35
        ? "ALERTA"
        : temp >= 32
          ? "ATENÇÃO"
          : "NORMAL"
      : "—";

  $("humidity-range").textContent =
    Number.isFinite(umid)
      ? umid < 30
        ? "ALERTA"
        : umid < 40
          ? "ATENÇÃO"
          : "NORMAL"
      : "—";

  $("temperature-bar").style.width =
    `${Math.max(0, Math.min(100, temp * 2))}%`;

  $("humidity-bar").style.width =
    `${Math.max(0, Math.min(100, umid))}%`;

  const presenceCard = $("presence-card");

  presenceCard.classList.toggle(
    "detected",
    pres
  );

  $("presence-value").textContent =
    pres ? "DETECTADO" : "VAZIO";

  $("presence-since").textContent =
    pres ? "movimento ativo" : "sem movimento";

  if (estado) {

    $("state-chip").textContent =
      estado === "ATENCAO"
        ? "ATENÇÃO"
        : estado;

    $("state-chip").className =
      `state-chip ${estado.toLowerCase()}`;

    $("state-card").className =
      `state-card ${estado.toLowerCase()}`;

    $("state-title").textContent =
      estado === "ATENCAO"
        ? "ATENÇÃO"
        : estado;

    $("state-description").textContent =
      estado === "NORMAL"
        ? "Condições dentro da faixa definida pelo SENTINELA."
        : estado === "ATENCAO"
          ? "Uma das variáveis entrou na faixa de atenção."
          : "Temperatura ou umidade atingiu a faixa de alerta.";

    document
      .querySelectorAll(".led")
      .forEach((led) => {

        led.classList.toggle(
          "active-normal",
          led.dataset.led === "NORMAL" &&
          estado === "NORMAL"
        );

        led.classList.toggle(
          "active-atencao",
          led.dataset.led === "ATENCAO" &&
          estado === "ATENCAO"
        );

        led.classList.toggle(
          "active-alerta",
          led.dataset.led === "ALERTA" &&
          estado === "ALERTA"
        );
      });
  }

  $("last-seen").textContent =
    formatarUltimoContato(state.ultimoContato);
}

async function carregarSensores() {

  try {

    const response =
      await fetch(
        SENSOR_URL,
        { cache: "no-store" }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const dados =
      await response.json();

    if (!dados) return;

    const contato =
      Number(dados.ultimoContato);

    // Heartbeat real do firmware novo.
    if (
      Number.isFinite(contato) &&
      contato > 1000000000000
    ) {

      const idade =
        Date.now() - contato;

      if (idade <= OFFLINE_AFTER_MS) {

        state =
          {
            ...state,
            ...dados,
            ultimoContato: contato
          };

        lastLiveActivity =
          Date.now();

        atualizarConexao(true);
        atualizarPainel();
      }
    }

  } catch (error) {

    console.warn(
      "Falha ao consultar /sensores:",
      error
    );
  }
}

async function carregarHistorico() {

  try {

    const response =
      await fetch(
        HISTORY_URL,
        { cache: "no-store" }
      );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const dados =
      await response.json();

    if (
      !dados ||
      typeof dados !== "object"
    ) {

      historyCache = [];

      $("history-empty")
        .classList.remove("is-hidden");

      renderCharts();
      return;
    }

    historyCache =
      Object.entries(dados)
        .map(
          ([key, record]) => ({
            key,
            ...(record || {}),
            timestamp:
              Number(
                record?.timestamp ?? 0
              ),
          })
        )
        .filter(
          (record) =>
            Number.isFinite(
              Number(record.temperatura)
            ) &&
            Number.isFinite(
              Number(record.umidade)
            )
        )
        .sort(
          (a, b) =>
            a.timestamp - b.timestamp
        );

    $("history-empty")
      .classList.toggle(
        "is-hidden",
        historyCache.length > 0
      );

    renderCharts();

    const ultima =
      historyCache[
        historyCache.length - 1
      ];

    if (!ultima) return;

    // O primeiro GET apenas carrega o histórico.
    // A atividade ao vivo passa a ser reconhecida
    // quando chegar uma nova coleta depois disso.
    if (primeiraCargaHistorico) {

      lastHistoryKey =
        ultima.key;

      primeiraCargaHistorico =
        false;

      return;
    }

    if (
      ultima.key !==
      lastHistoryKey
    ) {

      lastHistoryKey =
        ultima.key;

      registrarAtividadeAoVivo(
        ultima,
        "historico"
      );
    }

  } catch (error) {

    console.error(
      "Erro ao carregar histórico:",
      error
    );
  }
}

function criarOpcoesGrafico(
  label,
  unit
) {

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        displayColors: false,
        callbacks: {
          label: (ctx) =>
            `${label}: ${Number(
              ctx.parsed.y
            ).toFixed(1)} ${unit}`
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: "#75877a",
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
          font: {
            family: "DM Mono"
          }
        },
        grid: {
          color:
            "rgba(117,135,122,.08)"
        }
      },
      y: {
        ticks: {
          color: "#75877a",
          font: {
            family: "DM Mono"
          }
        },
        grid: {
          color:
            "rgba(117,135,122,.08)"
        }
      }
    }
  };
}

function prepararPontos() {

  const recortes =
    historyCache.slice(
      -historyLimit
    );

  return {

    labels:
      recortes.map(
        (r, i) => {

          // Timestamp antigo baseado em millis()
          // não representa horário real.
          if (
            Number.isFinite(
              r.timestamp
            ) &&
            r.timestamp > 1000000000000
          ) {

            return formatarData(
              r.timestamp
            );
          }

          return `Coleta ${i + 1}`;
        }
      ),

    temps:
      recortes.map(
        (r) =>
          Number(r.temperatura)
      ),

    umids:
      recortes.map(
        (r) =>
          Number(r.umidade)
      )
  };
}

function renderCharts() {

  const {
    labels,
    temps,
    umids
  } = prepararPontos();

  const datasetBase = {
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: .32,
    fill: true
  };

  if (!temperatureChart) {

    temperatureChart =
      new Chart(
        $("temperatureChart"),
        {
          type: "line",

          data: {
            labels,

            datasets: [
              {
                ...datasetBase,
                label: "Temperatura",
                data: temps,
                borderColor:
                  "#27e27b",
                backgroundColor:
                  "rgba(39,226,123,.10)"
              }
            ]
          },

          options:
            criarOpcoesGrafico(
              "Temperatura",
              "°C"
            )
        }
      );

  } else {

    temperatureChart.data.labels =
      labels;

    temperatureChart
      .data
      .datasets[0]
      .data =
        temps;

    temperatureChart.update(
      "none"
    );
  }

  if (!humidityChart) {

    humidityChart =
      new Chart(
        $("humidityChart"),
        {
          type: "line",

          data: {
            labels,

            datasets: [
              {
                ...datasetBase,
                label: "Umidade",
                data: umids,
                borderColor:
                  "#58a8ff",
                backgroundColor:
                  "rgba(88,168,255,.08)"
              }
            ]
          },

          options:
            criarOpcoesGrafico(
              "Umidade",
              "%"
            )
        }
      );

  } else {

    humidityChart.data.labels =
      labels;

    humidityChart
      .data
      .datasets[0]
      .data =
        umids;

    humidityChart.update(
      "none"
    );
  }
}

function verificarHardware() {

  if (
    !lastLiveActivity ||
    Date.now() -
      lastLiveActivity >
      OFFLINE_AFTER_MS
  ) {

    atualizarConexao(false);

    $("state-chip").textContent =
      "SEM DADOS";

    $("state-chip").className =
      "state-chip";

    $("last-seen").textContent =
      state.ultimoContato
        ? formatarUltimoContato(
            state.ultimoContato
          )
        : "—";
  }
}

function configurarNavegacao() {

  const links =
    document.querySelectorAll(
      ".nav-link"
    );

  const sections = [
    document.querySelector(
      "#monitor"
    ),
    document.querySelector(
      "#historico"
    )
  ];

  const observer =
    new IntersectionObserver(
      (entries) => {

        entries.forEach(
          (entry) => {

            if (
              !entry.isIntersecting
            ) {
              return;
            }

            links.forEach(
              (link) => {

                link.classList.toggle(
                  "active",
                  link.getAttribute(
                    "href"
                  ) ===
                    `#${entry.target.id}`
                );
              }
            );
          }
        );
      },
      {
        threshold: .35
      }
    );

  sections.forEach(
    (section) =>
      section &&
      observer.observe(section)
  );
}

function configurarFiltros() {

  document
    .querySelectorAll(
      ".filter-btn"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          () => {

            document
              .querySelectorAll(
                ".filter-btn"
              )
              .forEach(
                (b) =>
                  b.classList.remove(
                    "active"
                  )
              );

            button.classList.add(
              "active"
            );

            historyLimit =
              Number(
                button.dataset.range
              );

            renderCharts();
          }
        );
      }
    );
}

window.addEventListener(
  "load",
  async () => {

    configurarNavegacao();
    configurarFiltros();

    atualizarConexao(false);
    verificarHardware();

    await carregarSensores();
    await carregarHistorico();

    // Histórico é usado como fallback de
    // atividade para o firmware antigo.
    setInterval(
      carregarHistorico,
      HISTORY_POLL_MS
    );

    // Heartbeat/estado do firmware novo.
    setInterval(
      carregarSensores,
      SENSOR_POLL_MS
    );

    setInterval(
      verificarHardware,
      1000
    );
  }
);
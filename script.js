// URL apontando para a rota de histórico do seu Firebase
const apiHistoricoURL = 'https://sentinela-a5028-default-rtdb.firebaseio.com/historico.json';

let meuGrafico = null;
let ultimaAtualizacao = Date.now();
const tempoLimiteOffline = 6000; // 6 segundos sem sinal = Offline
let sistemaOffline = false;

// Inicializa o Gráfico de Tendência Temporal com Chart.js
function inicializarGrafico() {
    const ctx = document.getElementById('graficoHistorico').getContext('2d');
    meuGrafico = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [
                {
                    label: 'Temperatura (°C)',
                    data: [],
                    borderColor: '#00e676',
                    backgroundColor: 'rgba(0, 230, 118, 0.15)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Umidade (%)',
                    data: [],
                    borderColor: '#00b4d8',
                    backgroundColor: 'rgba(0, 180, 216, 0.15)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#ffffff', font: { family: 'Rajdhani', size: 14 } } }
            },
            scales: {
                x: { ticks: { color: '#8892b0' }, grid: { color: '#2a2a35' } },
                y: { ticks: { color: '#8892b0' }, grid: { color: '#2a2a35' } }
            }
        }
    });
}

async function carregarHistoricoEAtualizar() {
    try {
        const resposta = await fetch(apiHistoricoURL);
        const dados = resposta ? await resposta.json() : null;

        if (dados) {
            ultimaAtualizacao = Date.now();

            if (sistemaOffline) {
                sistemaOffline = false;
                const ind = document.querySelector('.online-indicator');
                ind.style.backgroundColor = '#00e676';
                ind.style.boxShadow = '0 0 8px #00e676';
                ind.classList.add('blinking');
                document.getElementById('footer-status').innerText = "Gravando histórico e plotando gráfico ao vivo";
            }

            const chaves = Object.keys(dados);
            const ultimasLeituras = chaves.slice(-15); // Pega as últimas 15 leituras para o gráfico

            let labels = [];
            let temps = [];
            let umids = [];

            ultimasLeituras.forEach((chave, index) => {
                let registro = dados[chave];
                labels.push(`Coleta ${index + 1}`);
                temps.push(registro.temperatura);
                umids.push(registro.umidade);

                // Atualiza o painel visual com a leitura mais recente
                if (index === ultimasLeituras.length - 1) {
                    atualizarCardsVisuais(registro.temperatura, registro.umidade, registro.presenca);
                }
            });

            // Atualiza o Gráfico dinamicamente
            if (meuGrafico) {
                meuGrafico.data.labels = labels;
                meuGrafico.data.datasets[0].data = temps;
                meuGrafico.data.datasets[1].data = umids;
                meuGrafico.update();
            }
        }
    } catch (erro) {
        console.error("Erro ao carregar histórico do Firebase:", erro);
        ativarModoOffline();
    }
}

function atualizarCardsVisuais(temp, umid, pres) {
    const badgeNormal = document.getElementById('badge-normal');
    const badgeAtencao = document.getElementById('badge-atencao');
    const badgeAlerta = document.getElementById('badge-alerta');

    badgeNormal.className = 'led-badge';
    badgeAtencao.className = 'led-badge';
    badgeAlerta.className = 'led-badge';

    document.getElementById('temp').innerHTML = `${temp.toFixed(1)} <span class="unit">°C</span>`;
    const tempFill = document.querySelector('.temp-fill');
    tempFill.style.width = `${Math.min((temp / 50) * 100, 100)}%`;

    let corTemp = '#00e676';
    if (temp > 35.0 || umid < 30.0) {
        corTemp = '#ff1744';
        badgeAlerta.classList.add('active-alerta');
    } else if ((temp >= 32.0 && temp <= 35.0) || (umid >= 30.0 && umid < 40.0)) {
        corTemp = '#ffea00';
        badgeAtencao.classList.add('active-atencao');
    } else {
        corTemp = '#00e676';
        badgeNormal.classList.add('active-normal');
    }
    tempFill.style.background = corTemp;
    tempFill.style.boxShadow = `0 0 10px ${corTemp}`;

    document.getElementById('umid').innerHTML = `${umid.toFixed(1)} <span class="unit">%</span>`;
    const umidFill = document.querySelector('.umid-fill');
    umidFill.style.width = `${umid}%`;

    const presencaElem = document.getElementById('pres');
    const presCard = document.getElementById('pres-card');
    if (pres === 1) {
        presencaElem.innerText = 'DETECTADO';
        presencaElem.style.color = '#ff1744';
        presCard.classList.add('active');
    } else {
        presencaElem.innerText = 'VAZIO';
        presencaElem.style.color = '#00e676';
        presCard.classList.remove('active');
    }
}

function verificarConexaoHardware() {
    if (Date.now() - ultimaAtualizacao > tempoLimiteOffline && !sistemaOffline) {
        ativarModoOffline();
    }
}

function ativarModoOffline() {
    sistemaOffline = true;
    document.getElementById('temp').innerHTML = `OFF <span class="unit">--</span>`;
    document.getElementById('umid').innerHTML = `OFF <span class="unit">--</span>`;
    document.getElementById('pres').innerText = 'OFFLINE';
    document.getElementById('pres').style.color = '#ff1744';

    document.getElementById('badge-normal').className = 'led-badge';
    document.getElementById('badge-atencao').className = 'led-badge';
    document.getElementById('badge-alerta').className = 'led-badge';

    const ind = document.querySelector('.online-indicator');
    ind.style.backgroundColor = '#ff1744';
    ind.style.boxShadow = '0 0 8px #ff1744';
    ind.classList.remove('blinking');
    
    document.getElementById('footer-status').innerText = "AVISO: Hardware desconectado ou sem dados!";
}

// Inicializa o painel e o gráfico
window.onload = () => {
    inicializarGrafico();
    setInterval(carregarHistoricoEAtualizar, 3000); // Atualiza os dados do gráfico a cada 3 segundos
    setInterval(verificarConexaoHardware, 1000);   // Verifica a saúde da conexão a cada 1 segundo
    carregarHistoricoEAtualizar();
};

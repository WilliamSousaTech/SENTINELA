// URL do seu novo Firebase
const apiURL = 'https://sentinela-a5028-default-rtdb.firebaseio.com/sensores.json';

// Controle de tempo para detecção de falhas (Heartbeat / Watchdog)
let ultimaAtualizacao = Date.now();
const tempoLimiteOffline = 6000; // 6 segundos sem sinal = Hardware Offline
let sistemaOffline = false;

async function atualizarDados() {
    try {
        const resposta = await fetch(apiURL);
        const dados = await resposta.json();

        if (dados) {
            // Sucesso na comunicação: atualiza o cronômetro
            ultimaAtualizacao = Date.now();

            if (sistemaOffline) {
                sistemaOffline = false;
                const ind = document.querySelector('.online-indicator');
                ind.style.backgroundColor = '#00e676';
                ind.style.boxShadow = '0 0 8px #00e676';
                ind.classList.add('blinking');
                document.getElementById('footer-status').innerText = "Ao vivo via Firebase do Google";
            }

            const temp = dados.temperatura;
            const umid = dados.umidade;
            const pres = dados.presenca;

            // 1. Atualiza Temperatura
            document.getElementById('temp').innerHTML = `${temp.toFixed(1)} <span class="unit">°C</span>`;
            const tempFill = document.querySelector('.temp-fill');
            const tempVal = Math.min((temp / 50) * 100, 100);
            tempFill.style.width = `${tempVal}%`;

            let corTemp = '#00e676'; // Normal
            if (temp > 35) corTemp = '#ff1744'; // Alerta
            else if (temp >= 32) corTemp = '#ffea00'; // Atenção

            tempFill.style.background = corTemp;
            tempFill.style.boxShadow = `0 0 10px ${corTemp}`;

            // 2. Atualiza Umidade
            document.getElementById('umid').innerHTML = `${umid.toFixed(1)} <span class="unit">%</span>`;
            const umidFill = document.querySelector('.umid-fill');
            umidFill.style.width = `${umid}%`;

            let corUmid = '#00b4d8'; // Normal
            if (umid < 30) corUmid = '#ff1744'; // Alerta
            else if (umid < 40) corUmid = '#ffea00'; // Atenção

            umidFill.style.background = corUmid;
            umidFill.style.boxShadow = `0 0 10px ${corUmid}`;

            // 3. Atualiza Presença (Sensor PIR)
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
    } catch (erro) {
        console.error("Erro de conexão com o Firebase:", erro);
        ativarModoOffline();
    }
}

// Verifica se a ESP32 parou de enviar dados
function verificarConexaoHardware() {
    const tempoDecorrido = Date.now() - ultimaAtualizacao;

    if (tempoDecorrido > tempoLimiteOffline && !sistemaOffline) {
        ativarModoOffline();
    }
}

function ativarModoOffline() {
    sistemaOffline = true;

    // Alerta visual de falha no painel
    document.getElementById('temp').innerHTML = `OFF <span class="unit">--</span>`;
    document.getElementById('umid').innerHTML = `OFF <span class="unit">--</span>`;
    
    const presencaElem = document.getElementById('pres');
    presencaElem.innerText = 'OFFLINE';
    presencaElem.style.color = '#ff1744';

    // Alerta no rodapé
    const ind = document.querySelector('.online-indicator');
    ind.style.backgroundColor = '#ff1744';
    ind.style.boxShadow = '0 0 8px #ff1744';
    ind.classList.remove('blinking');
    
    document.getElementById('footer-status').innerText = "AVISO: Hardware desconectado ou sem internet!";
}

// Ciclos de execução
setInterval(atualizarDados, 1500);            // Puxa novos dados do Firebase a cada 1.5s
setInterval(verificarConexaoHardware, 1000);   // Checa a saúde do hardware a cada 1s

// Chamada inicial
atualizarDados();

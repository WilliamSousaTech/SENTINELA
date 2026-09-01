const apiURL = 'https://projeto-sentinela-414cd-default-rtdb.firebaseio.com/sensores.json';

async function atualizarDados() {
    try {
        const resposta = await fetch(apiURL);
        const dados = await resposta.json();

        if (dados) {
            // Atualiza Temperatura e Umidade
            document.getElementById('temp').innerHTML = dados.temperatura.toFixed(1) + ' <span class="unit">°C</span>';
            document.getElementById('umid').innerHTML = dados.umidade.toFixed(1) + ' <span class="unit">%</span>';
            
            // LÓGICA DO ARTIGO CIENTÍFICO SENTINELA
            const temp = dados.temperatura;
            const umid = dados.umidade;
            let estado = "NORMAL";
            let cor = "#00e676"; // Verde

            // Regra 1: Alerta (Vermelho)
            if (temp > 35 || umid < 30) {
                estado = "ALERTA";
                cor = "#ff1744"; // Vermelho
            } 
            // Regra 2: Atenção (Amarelo)
            else if ((temp >= 32 && temp <= 35) || (umid >= 30 && umid <= 39)) {
                estado = "ATENÇÃO";
                cor = "#ffea00"; // Amarelo
            }
            // Regra 3: Normal (Verde) - já definido como padrão (temp < 32 e umid >= 40)

            // Aplica as cores nas barras (Front-end)
            document.querySelector('.temp-fill').style.backgroundColor = cor;
            document.querySelector('.umid-fill').style.backgroundColor = cor;
            document.querySelector('.temp-fill').style.boxShadow = `0 0 10px ${cor}`;
            document.querySelector('.umid-fill').style.boxShadow = `0 0 10px ${cor}`;
            document.querySelector('.temp-fill').style.width = Math.min((temp / 50) * 100, 100) + '%';
            document.querySelector('.umid-fill').style.width = umid + '%';
            
            // Atualiza Presença (Sensor PIR)
            const presencaElem = document.getElementById('pres');
            const presCard = document.getElementById('pres-card');
            
            if (dados.presenca === 1) {
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
        document.querySelector('.online-indicator').style.backgroundColor = 'red';
    }
}

// Inicia a varredura (agora puxando mais rápido)
setInterval(atualizarDados, 1500);
atualizarDados();
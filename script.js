// =====================================================
// FIREBASE
// =====================================================

const firebaseURL =
    'https://sentinela-a5028-default-rtdb.firebaseio.com/sensores.json';


// =====================================================
// ESTADO LOCAL
// =====================================================

let dados = {

    temperatura: null,

    umidade: null,

    presenca: 0,

    estado: 'NORMAL',

    ultimoContato: null

};


let sistemaOffline = true;


// =====================================================
// ELEMENTOS
// =====================================================

const tempElement =
    document.getElementById('temp');

const umidElement =
    document.getElementById('umid');

const presElement =
    document.getElementById('pres');

const presCard =
    document.getElementById('pres-card');

const tempFill =
    document.querySelector('.temp-fill');

const umidFill =
    document.querySelector('.umid-fill');

const stateCard =
    document.getElementById('state-card');

const stateName =
    document.getElementById('state-name');

const stateDescription =
    document.getElementById('state-description');

const indicator =
    document.querySelector('.online-indicator');

const footerStatus =
    document.getElementById('footer-status');


// =====================================================
// ATUALIZAR CONEXÃO
// =====================================================

function definirOnline() {

    if (!sistemaOffline) {
        return;
    }

    sistemaOffline = false;

    indicator.classList.remove('offline');

    indicator.classList.add('online');

    indicator.classList.add('blinking');

    footerStatus.innerText =
        'ESP32 ONLINE • Firebase em tempo real';
}


function definirOffline() {

    if (sistemaOffline) {
        return;
    }

    sistemaOffline = true;

    indicator.classList.remove('online');

    indicator.classList.remove('blinking');

    indicator.classList.add('offline');

    footerStatus.innerText =
        'ESP32 OFFLINE • Sem sinal recente';
}


// =====================================================
// TEMPERATURA
// =====================================================

function atualizarTemperatura() {

    if (
        typeof dados.temperatura !== 'number'
    ) {

        return;
    }


    const temp =
        dados.temperatura;


    tempElement.innerHTML =
        `${temp.toFixed(1)}
        <span class="unit">°C</span>`;


    const percentual =
        Math.min(
            Math.max(
                (temp / 50) * 100,
                0
            ),
            100
        );


    tempFill.style.width =
        `${percentual}%`;


    let cor =
        '#00e676';


    if (temp > 35) {

        cor = '#ff1744';

    }

    else if (temp >= 32) {

        cor = '#ffea00';
    }


    tempFill.style.background =
        cor;

    tempFill.style.boxShadow =
        `0 0 10px ${cor}`;
}


// =====================================================
// UMIDADE
// =====================================================

function atualizarUmidade() {

    if (
        typeof dados.umidade !== 'number'
    ) {

        return;
    }


    const umid =
        dados.umidade;


    umidElement.innerHTML =
        `${umid.toFixed(1)}
        <span class="unit">%</span>`;


    umidFill.style.width =
        `${Math.min(Math.max(umid, 0), 100)}%`;


    let cor =
        '#00b4d8';


    if (umid < 30) {

        cor = '#ff1744';

    }

    else if (umid < 40) {

        cor = '#ffea00';
    }


    umidFill.style.background =
        cor;

    umidFill.style.boxShadow =
        `0 0 10px ${cor}`;
}


// =====================================================
// PIR
// =====================================================

function atualizarPIR() {

    const presenca =
        Number(dados.presenca);


    if (presenca === 1) {

        presElement.innerText =
            'DETECTADO';

        presElement.style.color =
            '#ff1744';

        presCard.classList.add(
            'active'
        );

    }

    else {

        presElement.innerText =
            'VAZIO';

        presElement.style.color =
            '#00e676';

        presCard.classList.remove(
            'active'
        );
    }
}


// =====================================================
// ESTADO AMBIENTAL
// =====================================================

function atualizarEstado() {

    const estado =
        String(
            dados.estado || 'NORMAL'
        ).toUpperCase();


    stateCard.classList.remove(
        'normal',
        'atencao',
        'alerta'
    );


    // =================================================
    // NORMAL
    // =================================================

    if (estado === 'NORMAL') {

        stateCard.classList.add(
            'normal'
        );

        stateName.innerText =
            'NORMAL';

        stateDescription.innerText =
            'Ambiente dentro dos parâmetros';
    }


    // =================================================
    // ATENÇÃO
    // =================================================

    else if (
        estado === 'ATENCAO' ||
        estado === 'ATENÇÃO'
    ) {

        stateCard.classList.add(
            'atencao'
        );

        stateName.innerText =
            'ATENÇÃO';

        stateDescription.innerText =
            'Condições que exigem atenção';
    }


    // =================================================
    // ALERTA
    // =================================================

    else if (estado === 'ALERTA') {

        stateCard.classList.add(
            'alerta'
        );

        stateName.innerText =
            'ALERTA';

        stateDescription.innerText =
            'Condições críticas detectadas';
    }
}


// =====================================================
// ATUALIZAR TELA
// =====================================================

function atualizarTela() {

    atualizarTemperatura();

    atualizarUmidade();

    atualizarPIR();

    atualizarEstado();
}


// =====================================================
// APLICAR EVENTO DO FIREBASE
// =====================================================

function aplicarEventoFirebase(evento) {

    try {

        const pacote =
            JSON.parse(evento.data);


        const caminho =
            pacote.path;


        const valor =
            pacote.data;


        // =============================================
        // PUT
        // =============================================

        if (
            caminho === '/' ||
            caminho === ''
        ) {

            if (
                valor &&
                typeof valor === 'object'
            ) {

                dados = {
                    ...dados,
                    ...valor
                };
            }
        }


        // =============================================
        // PATCH / PUT EM CAMINHO ESPECÍFICO
        // =============================================

        else {

            const partes =
                caminho
                    .split('/')
                    .filter(Boolean);


            let alvo =
                dados;


            for (
                let i = 0;
                i < partes.length - 1;
                i++
            ) {

                const parte =
                    partes[i];


                if (
                    typeof alvo[parte] !== 'object' ||
                    alvo[parte] === null
                ) {

                    alvo[parte] = {};
                }


                alvo =
                    alvo[parte];
            }


            const ultimaParte =
                partes[partes.length - 1];


            if (
                ultimaParte
            ) {

                alvo[ultimaParte] =
                    valor;
            }
        }


        // =============================================
        // RECEBEU DADOS
        // =============================================

        definirOnline();

        atualizarTela();

    }

    catch (erro) {

        console.error(
            'Erro processando Firebase:',
            erro
        );
    }
}


// =====================================================
// STREAM FIREBASE
// =====================================================

function conectarFirebase() {

    console.log(
        'Conectando ao Firebase em tempo real...'
    );


    const stream =
        new EventSource(
            firebaseURL
        );


    // ==============================================
    // PUT
    // ==============================================

    stream.addEventListener(
        'put',
        aplicarEventoFirebase
    );


    // ==============================================
    // PATCH
    // ==============================================

    stream.addEventListener(
        'patch',
        aplicarEventoFirebase
    );


    // ==============================================
    // KEEP ALIVE
    // ==============================================

    stream.addEventListener(
        'keep-alive',
        () => {

            console.log(
                'Firebase: conexão ativa'
            );
        }
    );


    // ==============================================
    // ERRO
    // ==============================================

    stream.onerror =
        () => {

            console.warn(
                'Conexão com Firebase interrompida.'
            );

            stream.close();

            setTimeout(
                conectarFirebase,
                1000
            );
        };
}


// =====================================================
// VERIFICAR HEARTBEAT DA ESP32
// =====================================================

function verificarHardware() {

    if (
        typeof dados.ultimoContato !==
        'number'
    ) {

        return;
    }


    const agora =
        Date.now();


    const atraso =
        agora -
        dados.ultimoContato;


    // 7 segundos sem heartbeat
    if (
        atraso > 7000
    ) {

        definirOffline();

    }

    else {

        definirOnline();
    }
}


// =====================================================
// VERIFICAÇÃO DO HARDWARE
// =====================================================

setInterval(
    verificarHardware,
    1000
);


// =====================================================
// INICIAR
// =====================================================

conectarFirebase();

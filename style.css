* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}


body {

    background-color: #08080c;

    color: #fff;

    font-family: 'Rajdhani', sans-serif;

    min-height: 100vh;

    display: flex;

    justify-content: center;

    align-items: center;

    overflow-x: hidden;

    position: relative;
}


.glow-bg {

    position: absolute;

    top: 50%;
    left: 50%;

    width: 600px;
    height: 600px;

    background:
        radial-gradient(
            circle,
            rgba(0, 230, 118, 0.1) 0%,
            rgba(0, 0, 0, 0) 60%
        );

    transform: translate(-50%, -50%);

    z-index: -1;
}


.container {

    width: 90%;

    max-width: 1100px;

    text-align: center;

    z-index: 1;

    padding: 20px 0;
}


header h1 {

    font-family: 'Orbitron', sans-serif;

    font-size: 3.5rem;

    letter-spacing: 4px;

    margin-bottom: 5px;
}


.neon-text {

    color: #00e676;

    text-shadow:
        0 0 10px #00e676,
        0 0 20px rgba(0, 230, 118, 0.5);
}


.subtitle {

    color: #6c757d;

    font-size: 1.1rem;

    margin-bottom: 40px;

    letter-spacing: 2px;

    text-transform: uppercase;
}


.dashboard {

    display: flex;

    gap: 30px;

    justify-content: center;

    flex-wrap: wrap;
}


.card {

    background: rgba(20, 20, 25, 0.7);

    border: 1px solid #2a2a35;

    border-radius: 16px;

    padding: 35px 20px;

    width: 250px;

    min-height: 250px;

    backdrop-filter: blur(12px);

    box-shadow:
        0 8px 32px rgba(0, 0, 0, 0.4);

    transition:
        transform 0.2s ease,
        box-shadow 0.2s ease,
        border-color 0.2s ease;

    position: relative;

    overflow: hidden;
}


.card:hover {

    transform: translateY(-4px);

    border-color: #00e676;
}


.card-icon {

    font-size: 2.5rem;

    margin-bottom: 15px;

    opacity: 0.8;
}


.card h3 {

    font-size: 1.2rem;

    color: #9aa0a6;

    text-transform: uppercase;

    letter-spacing: 1.5px;

    margin-bottom: 15px;
}


.valor {

    font-family: 'Orbitron', sans-serif;

    font-size: 2.4rem;

    font-weight: 700;
}


.unit {

    font-size: 1.2rem;

    color: #5f6368;
}


.status-bar {

    width: 100%;

    height: 6px;

    background: #1e1e24;

    margin-top: 25px;

    border-radius: 3px;

    overflow: hidden;
}


.fill {

    height: 100%;

    width: 0%;

    transition:
        width 0.2s linear,
        background 0.2s linear;
}


.temp-fill {

    background: #00e676;

    box-shadow:
        0 0 10px #00e676;
}


.umid-fill {

    background: #00b4d8;

    box-shadow:
        0 0 10px #00b4d8;
}



/* =====================================================
   PIR
===================================================== */

.alert-card.active {

    border-color: #ff1744;

    box-shadow:
        0 0 30px rgba(255, 23, 68, 0.3);

    background:
        rgba(35, 15, 20, 0.8);
}


.radar {

    width: 50px;

    height: 50px;

    border: 2px solid #00e676;

    border-radius: 50%;

    margin: 20px auto 0;

    position: relative;

    transition:
        border-color 0.15s ease;
}


.radar::after {

    content: '';

    position: absolute;

    top: 50%;
    left: 50%;

    width: 100%;
    height: 100%;

    background:
        rgba(0, 230, 118, 0.3);

    border-radius: 50%;

    transform:
        translate(-50%, -50%);

    animation:
        pulse 2s infinite;
}


.alert-card.active .radar {

    border-color: #ff1744;
}


.alert-card.active .radar::after {

    background:
        rgba(255, 23, 68, 0.4);

    animation:
        pulse-alert 0.45s infinite;
}


@keyframes pulse {

    0% {

        transform:
            translate(-50%, -50%)
            scale(0.5);

        opacity: 1;
    }

    100% {

        transform:
            translate(-50%, -50%)
            scale(1.8);

        opacity: 0;
    }
}


@keyframes pulse-alert {

    0% {

        transform:
            translate(-50%, -50%)
            scale(0.7);

        opacity: 1;
    }

    100% {

        transform:
            translate(-50%, -50%)
            scale(1.5);

        opacity: 0;
    }
}



/* =====================================================
   ESTADO AMBIENTAL
===================================================== */

.state-card {

    transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
}


.state-led {

    width: 32px;

    height: 32px;

    border-radius: 50%;

    margin: 0 auto 20px;

    transition:
        background 0.2s ease,
        box-shadow 0.2s ease;
}


.state-name {

    font-family: 'Orbitron', sans-serif;

    font-size: 2rem;

    font-weight: 700;

    margin-bottom: 15px;
}


.state-description {

    color: #9aa0a6;

    font-size: 1rem;
}



/* NORMAL */

.state-card.normal {

    border-color: #00e676;

    box-shadow:
        0 0 25px rgba(0, 230, 118, 0.15);
}


.state-card.normal .state-led {

    background: #00e676;

    box-shadow:
        0 0 20px #00e676;
}


.state-card.normal .state-name {

    color: #00e676;
}



/* ATENÇÃO */

.state-card.atencao {

    border-color: #ffea00;

    box-shadow:
        0 0 25px rgba(255, 234, 0, 0.15);
}


.state-card.atencao .state-led {

    background: #ffea00;

    box-shadow:
        0 0 20px #ffea00;
}


.state-card.atencao .state-name {

    color: #ffea00;
}



/* ALERTA */

.state-card.alerta {

    border-color: #ff1744;

    box-shadow:
        0 0 30px rgba(255, 23, 68, 0.25);
}


.state-card.alerta .state-led {

    background: #ff1744;

    box-shadow:
        0 0 20px #ff1744;
}


.state-card.alerta .state-name {

    color: #ff1744;
}



/* =====================================================
   CONEXÃO
===================================================== */

footer {

    margin-top: 50px;

    color: #5f6368;

    font-size: 0.95rem;

    letter-spacing: 1px;
}


.online-indicator {

    display: inline-block;

    width: 10px;

    height: 10px;

    background: #ff1744;

    border-radius: 50%;

    margin-right: 6px;

    box-shadow:
        0 0 8px #ff1744;

    transition:
        background 0.15s,
        box-shadow 0.15s;
}


.online-indicator.online {

    background: #00e676;

    box-shadow:
        0 0 8px #00e676;
}


.online-indicator.offline {

    background: #ff1744;

    box-shadow:
        0 0 8px #ff1744;
}


@keyframes blink {

    0%, 100% {
        opacity: 1;
    }

    50% {
        opacity: 0.35;
    }
}


.blinking {

    animation:
        blink 1.5s infinite;
}



/* =====================================================
   RESPONSIVO
===================================================== */

@media (max-width: 700px) {

    header h1 {

        font-size: 2.4rem;
    }

    .subtitle {

        font-size: 0.85rem;
    }

    .card {

        width: 100%;

        max-width: 330px;
    }
}

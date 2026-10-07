#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include "DHT.h"

// =====================================================
// SENTINELA OS — FIRMWARE ESP32
// =====================================================
// /sensores  = estado atual + heartbeat
// /historico = novas coletas para os gráficos
//
// NÃO publique suas credenciais reais no GitHub.
// =====================================================

#define DHTPIN 23
#define DHTTYPE DHT11

#define PIRPIN 19
#define BUZZERPIN 18

#define LED_VERDE 25
#define LED_AMARELO 26
#define LED_VERMELHO 27

DHT dht(DHTPIN, DHTTYPE);

// =====================================================
// WI-FI
// =====================================================

const char* ssid = "COLOQUE_SUA_REDE";
const char* senha = "COLOQUE_SUA_SENHA";

// =====================================================
// FIREBASE
// =====================================================

const char* sensoresUrl =
  "https://sentinela-a5028-default-rtdb.firebaseio.com/sensores.json?print=silent";

const char* historicoUrl =
  "https://sentinela-a5028-default-rtdb.firebaseio.com/historico.json?print=silent";

// =====================================================
// INTERVALOS
// =====================================================

const unsigned long INTERVALO_DHT = 2000;
const unsigned long INTERVALO_HISTORICO = 3000;
const unsigned long INTERVALO_HEARTBEAT = 3000;
const unsigned long INTERVALO_RECONEXAO_WIFI = 5000;

// =====================================================
// ESTADO
// =====================================================

float temperatura = 0.0;
float umidade = 0.0;

int ultimaPresenca = -1;

String estadoAtual = "NORMAL";

unsigned long ultimoDHT = 0;
unsigned long ultimoHistorico = 0;
unsigned long ultimoHeartbeat = 0;
unsigned long ultimaTentativaWiFi = 0;

// =====================================================
// PIR — INTERRUPÇÃO
// =====================================================

volatile bool pirMudou = false;

void IRAM_ATTR interrupcaoPIR() {
  pirMudou = true;
}

// =====================================================
// BUZZER NÃO BLOQUEANTE
// =====================================================

unsigned long ultimoBeep = 0;
bool buzzerLigado = false;

// =====================================================
// CLIENTES HTTPS
// =====================================================

WiFiClientSecure sensorClient;
WiFiClientSecure historicoClient;

HTTPClient sensorHttp;
HTTPClient historicoHttp;

bool sensorHttpPreparado = false;
bool historicoHttpPreparado = false;

// =====================================================
// CLASSIFICAÇÃO
// =====================================================

String classificarAmbiente(float temp, float umid) {

  if (temp > 35.0 || umid < 30.0) {
    return "ALERTA";
  }

  if (
    (temp >= 32.0 && temp <= 35.0) ||
    (umid >= 30.0 && umid < 40.0)
  ) {
    return "ATENCAO";
  }

  return "NORMAL";
}

// =====================================================
// LEDS
// =====================================================

void atualizarLEDs(const String& estado) {

  digitalWrite(LED_VERDE, estado == "NORMAL" ? HIGH : LOW);
  digitalWrite(LED_AMARELO, estado == "ATENCAO" ? HIGH : LOW);
  digitalWrite(LED_VERMELHO, estado == "ALERTA" ? HIGH : LOW);
}

// =====================================================
// BUZZER
// =====================================================

void atualizarBuzzer() {

  const unsigned long agora = millis();

  if (estadoAtual == "NORMAL") {
    digitalWrite(BUZZERPIN, LOW);
    buzzerLigado = false;
    return;
  }

  if (estadoAtual == "ATENCAO") {

    if (!buzzerLigado) {

      if (agora - ultimoBeep >= 1000) {
        digitalWrite(BUZZERPIN, HIGH);
        buzzerLigado = true;
        ultimoBeep = agora;
      }
    }
    else {

      if (agora - ultimoBeep >= 150) {
        digitalWrite(BUZZERPIN, LOW);
        buzzerLigado = false;
        ultimoBeep = agora;
      }
    }

    return;
  }

  if (estadoAtual == "ALERTA") {

    if (agora - ultimoBeep >= 80) {

      ultimoBeep = agora;
      buzzerLigado = !buzzerLigado;

      digitalWrite(
        BUZZERPIN,
        buzzerLigado ? HIGH : LOW
      );
    }
  }
}

// =====================================================
// ENCERRAR CLIENTES
// =====================================================

void encerrarFirebase() {

  if (sensorHttpPreparado) {
    sensorHttp.end();
    sensorHttpPreparado = false;
  }

  if (historicoHttpPreparado) {
    historicoHttp.end();
    historicoHttpPreparado = false;
  }
}

// =====================================================
// PREPARAR /SENSORES
// =====================================================

bool prepararSensores() {

  if (sensorHttpPreparado) {
    return true;
  }

  sensorClient.setInsecure();

  if (sensorHttp.begin(sensorClient, sensoresUrl)) {

    sensorHttp.addHeader(
      "Content-Type",
      "application/json"
    );

    sensorHttp.addHeader(
      "Connection",
      "keep-alive"
    );

    sensorHttpPreparado = true;
    return true;
  }

  Serial.println(
    "Erro ao preparar Firebase /sensores."
  );

  return false;
}

// =====================================================
// PREPARAR /HISTORICO
// =====================================================

bool prepararHistorico() {

  if (historicoHttpPreparado) {
    return true;
  }

  historicoClient.setInsecure();

  if (historicoHttp.begin(
    historicoClient,
    historicoUrl
  )) {

    historicoHttp.addHeader(
      "Content-Type",
      "application/json"
    );

    historicoHttp.addHeader(
      "Connection",
      "keep-alive"
    );

    historicoHttpPreparado = true;
    return true;
  }

  Serial.println(
    "Erro ao preparar Firebase /historico."
  );

  return false;
}

// =====================================================
// ATUALIZAR /SENSORES
// =====================================================

bool enviarSensores(
  bool incluirTemperatura,
  bool incluirUmidade,
  bool incluirPresenca,
  bool incluirEstado,
  bool incluirHeartbeat
) {

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  if (!prepararSensores()) {
    return false;
  }

  String json = "{";
  bool primeiro = true;

  if (incluirTemperatura) {

    json += "\"temperatura\":";
    json += String(temperatura, 1);

    primeiro = false;
  }

  if (incluirUmidade) {

    if (!primeiro) {
      json += ",";
    }

    json += "\"umidade\":";
    json += String(umidade, 1);

    primeiro = false;
  }

  if (incluirPresenca) {

    if (!primeiro) {
      json += ",";
    }

    json += "\"presenca\":";
    json += String(digitalRead(PIRPIN));

    primeiro = false;
  }

  if (incluirEstado) {

    if (!primeiro) {
      json += ",";
    }

    json += "\"estado\":\"";
    json += estadoAtual;
    json += "\"";

    primeiro = false;
  }

  if (incluirHeartbeat) {

    if (!primeiro) {
      json += ",";
    }

    json += "\"ultimoContato\":";
    json += "{\".sv\":\"timestamp\"}";
  }

  json += "}";

  int codigo = sensorHttp.PATCH(json);

  if (codigo == 200 || codigo == 204) {
    return true;
  }

  Serial.print(
    "Erro Firebase /sensores: HTTP "
  );

  Serial.println(codigo);

  sensorHttp.end();
  sensorHttpPreparado = false;

  return false;
}

// =====================================================
// REGISTRAR HISTÓRICO
// =====================================================

bool registrarHistorico() {

  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }

  if (!prepararHistorico()) {
    return false;
  }

  String json = "{";

  json += "\"temperatura\":";
  json += String(temperatura, 1);

  json += ",\"umidade\":";
  json += String(umidade, 1);

  json += ",\"presenca\":";
  json += String(digitalRead(PIRPIN));

  json += ",\"estado\":\"";
  json += estadoAtual;
  json += "\"";

  // Timestamp do servidor Firebase.
  // Não reinicia quando a ESP32 reinicia.
  json += ",\"timestamp\":";
  json += "{\".sv\":\"timestamp\"}";

  json += "}";

  int codigo = historicoHttp.POST(json);

  if (codigo == 200 || codigo == 201) {
    return true;
  }

  Serial.print(
    "Erro Firebase /historico: HTTP "
  );

  Serial.println(codigo);

  historicoHttp.end();
  historicoHttpPreparado = false;

  return false;
}

// =====================================================
// PROCESSAR PIR
// =====================================================

void processarPIR() {

  bool houveMudanca = false;

  noInterrupts();

  if (pirMudou) {
    pirMudou = false;
    houveMudanca = true;
  }

  interrupts();

  if (!houveMudanca) {
    return;
  }

  const int presencaAtual =
    digitalRead(PIRPIN);

  if (presencaAtual == ultimaPresenca) {
    return;
  }

  ultimaPresenca =
    presencaAtual;

  Serial.println();
  Serial.println(">>> MUDANCA NO PIR <<<");

  if (presencaAtual == HIGH) {
    Serial.println(">>> MOVIMENTO DETECTADO <<<");
  }
  else {
    Serial.println(">>> MOVIMENTO ENCERRADO <<<");
  }

  // Envia imediatamente a mudança.
  enviarSensores(
    false,
    false,
    true,
    false,
    true
  );
}

// =====================================================
// ATUALIZAR DHT11
// =====================================================

void atualizarDHT() {

  const unsigned long agora =
    millis();

  if (
    agora - ultimoDHT <
    INTERVALO_DHT
  ) {
    return;
  }

  ultimoDHT =
    agora;

  const float novaTemperatura =
    dht.readTemperature();

  const float novaUmidade =
    dht.readHumidity();

  if (
    isnan(novaTemperatura) ||
    isnan(novaUmidade)
  ) {

    Serial.println();
    Serial.println(
      "ERRO AO LER DHT11!"
    );

    return;
  }

  temperatura =
    novaTemperatura;

  umidade =
    novaUmidade;

  const String novoEstado =
    classificarAmbiente(
      temperatura,
      umidade
    );

  const bool mudou =
    novoEstado != estadoAtual;

  estadoAtual =
    novoEstado;

  atualizarLEDs(
    estadoAtual
  );

  if (mudou) {

    ultimoBeep =
      millis();

    buzzerLigado =
      false;

    digitalWrite(
      BUZZERPIN,
      LOW
    );
  }

  Serial.println();
  Serial.println(
    "================================"
  );
  Serial.println(
    "          SENTINELA OS"
  );
  Serial.println(
    "================================"
  );

  Serial.print(
    "Temperatura: "
  );
  Serial.print(
    temperatura,
    1
  );
  Serial.println(
    " °C"
  );

  Serial.print(
    "Umidade: "
  );
  Serial.print(
    umidade,
    1
  );
  Serial.println(
    " %"
  );

  Serial.print(
    "Presença: "
  );
  Serial.println(
    digitalRead(PIRPIN) == HIGH
      ? "DETECTADO"
      : "VAZIO"
  );

  Serial.print(
    "Estado: "
  );
  Serial.println(
    estadoAtual
  );

  Serial.println(
    "================================"
  );

  // Estado atual.
  enviarSensores(
    true,
    true,
    true,
    true,
    true
  );
}

// =====================================================
// VERIFICAR HISTÓRICO
// =====================================================

void verificarHistorico() {

  const unsigned long agora =
    millis();

  if (
    agora - ultimoHistorico <
    INTERVALO_HISTORICO
  ) {
    return;
  }

  ultimoHistorico =
    agora;

  if (registrarHistorico()) {
    Serial.println(
      "Histórico registrado."
    );
  }
}

// =====================================================
// HEARTBEAT
// =====================================================

void verificarHeartbeat() {

  const unsigned long agora =
    millis();

  if (
    agora - ultimoHeartbeat <
    INTERVALO_HEARTBEAT
  ) {
    return;
  }

  ultimoHeartbeat =
    agora;

  enviarSensores(
    false,
    false,
    false,
    false,
    true
  );
}

// =====================================================
// WIFI
// =====================================================

void verificarWiFi() {

  if (
    WiFi.status() ==
    WL_CONNECTED
  ) {
    return;
  }

  const unsigned long agora =
    millis();

  if (
    agora - ultimaTentativaWiFi <
    INTERVALO_RECONEXAO_WIFI
  ) {
    return;
  }

  ultimaTentativaWiFi =
    agora;

  Serial.println();
  Serial.println(
    "Wi-Fi desconectado."
  );

  Serial.println(
    "Tentando reconectar..."
  );

  encerrarFirebase();

  WiFi.disconnect();
  WiFi.begin(
    ssid,
    senha
  );
}

// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(
    115200
  );

  // ---------------------------------------------------
  // SENSORES
  // ---------------------------------------------------

  dht.begin();

  pinMode(
    PIRPIN,
    INPUT
  );

  // Detecta subida e descida do PIR
  // sem bloquear o loop principal.
  attachInterrupt(
    digitalPinToInterrupt(PIRPIN),
    interrupcaoPIR,
    CHANGE
  );

  // ---------------------------------------------------
  // SAÍDAS
  // ---------------------------------------------------

  pinMode(
    BUZZERPIN,
    OUTPUT
  );

  pinMode(
    LED_VERDE,
    OUTPUT
  );

  pinMode(
    LED_AMARELO,
    OUTPUT
  );

  pinMode(
    LED_VERMELHO,
    OUTPUT
  );

  digitalWrite(
    BUZZERPIN,
    LOW
  );

  digitalWrite(
    LED_VERDE,
    LOW
  );

  digitalWrite(
    LED_AMARELO,
    LOW
  );

  digitalWrite(
    LED_VERMELHO,
    LOW
  );

  // ---------------------------------------------------
  // WIFI
  // ---------------------------------------------------

  WiFi.mode(
    WIFI_STA
  );

  WiFi.begin(
    ssid,
    senha
  );

  Serial.println();
  Serial.println(
    "================================"
  );
  Serial.println(
    "       SENTINELA OS"
  );
  Serial.println(
    "================================"
  );

  Serial.print(
    "Conectando ao Wi-Fi"
  );

  while (
    WiFi.status() !=
    WL_CONNECTED
  ) {

    delay(300);
    Serial.print(".");
  }

  Serial.println();
  Serial.println(
    "Wi-Fi conectado!"
  );

  Serial.print(
    "IP: "
  );

  Serial.println(
    WiFi.localIP()
  );

  // ---------------------------------------------------
  // PIR INICIAL
  // ---------------------------------------------------

  ultimaPresenca =
    digitalRead(PIRPIN);

  Serial.print(
    "PIR inicial: "
  );

  Serial.println(
    ultimaPresenca
  );

  // ---------------------------------------------------
  // PRIMEIRA LEITURA DHT
  // ---------------------------------------------------

  ultimoDHT =
    INTERVALO_DHT;

  // ---------------------------------------------------
  // PRIMEIRO CONTATO
  // ---------------------------------------------------

  enviarSensores(
    false,
    false,
    true,
    false,
    true
  );

  Serial.println();
  Serial.println(
    "Sistema SENTINELA iniciado."
  );
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  // PIR primeiro.
  processarPIR();

  // DHT.
  atualizarDHT();

  // Buzzer.
  atualizarBuzzer();

  // Histórico.
  verificarHistorico();

  // Heartbeat.
  verificarHeartbeat();

  // Wi-Fi.
  verificarWiFi();

  delay(2);
}
